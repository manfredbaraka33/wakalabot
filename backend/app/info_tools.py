"""
Tools exclusive to INFO bot type — no commerce, no products, no stock.
Pure Q&A, inquiry logging, and human escalation.
"""
import json
import re
from typing import Any, Dict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Conversation, KnowledgeBase, LeadEvent, CustomerNote, Notification

INFO_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_knowledge_base",
            "description": "Search the organization's knowledge base for facts, policies, FAQs, procedures, or general information. Use this for almost every question.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_org_info",
            "description": "Fetch organization details: hours, location, contact phone, website, description.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_inquiry",
            "description": "Save a request from someone who wants a human to follow up — a specific application, complaint, or complex question the knowledge base can't answer. Requires their name and phone if they've given it.",
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string", "description": "Short summary of what they need, e.g. 'Swali kuhusu usajili wa mwanafunzi'"},
                    "notes": {"type": "string", "description": "Additional detail"},
                    "customer_phone": {"type": "string", "description": "Real phone number if collected this conversation (guests only)"},
                    "customer_name": {"type": "string", "description": "Name if collected this conversation"},
                },
                "required": ["topic"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "escalate_to_human",
            "description": "Flag this conversation for staff to handle personally — complex, sensitive, or the person is upset.",
            "parameters": {
                "type": "object",
                "properties": {"reason": {"type": "string"}},
                "required": ["reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "log_unanswered_question",
            "description": "Log a question the knowledge base could not answer, so staff can add that info later.",
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "category": {"type": "string", "enum": ["policy", "procedure", "contact", "general", "other"]},
                },
                "required": ["question", "category"],
            },
        },
    },
]


class InfoToolExecutor:
    def __init__(self, db: AsyncSession, tenant_id, conv: Conversation):
        self.db = db
        self.tenant_id = tenant_id
        self.conv = conv

    async def execute(self, tool_name: str, args: Dict[str, Any]) -> str:
        try:
            handler = getattr(self, tool_name, None)
            if handler is None:
                return json.dumps({"error": f"Unknown tool: {tool_name}"})
            return await handler(**args)
        except TypeError as e:
            return json.dumps({"error": f"Invalid arguments: {str(e)}"})
        except Exception as e:
            return json.dumps({"error": f"Tool failed: {str(e)}"})

    async def search_knowledge_base(self, query: str) -> str:
        from app.services import ai_engine
        emb = await ai_engine._embed(query)
        stmt = (
            select(KnowledgeBase)
            .where(
                KnowledgeBase.tenant_id == self.tenant_id,
                KnowledgeBase.content.not_like("__SHOP_SETTINGS__%"),
                KnowledgeBase.content.not_like("__CUSTOMER_NOTICE__%"),
            )
            .order_by(KnowledgeBase.embedding.cosine_distance(emb))
            .limit(3)
        )
        result = await self.db.execute(stmt)
        docs = result.scalars().all()
        if not docs:
            return json.dumps({"found": False, "message": "Hakuna taarifa zilizopatikana."})
        return json.dumps({
            "found": True,
            "results": [{"content": d.content} for d in docs],
        })

    async def get_org_info(self) -> str:
        from app.models import Tenant
        result = await self.db.execute(select(Tenant).where(Tenant.id == self.tenant_id))
        tenant = result.scalar_one_or_none()
        settings_result = await self.db.execute(
            select(KnowledgeBase).where(
                KnowledgeBase.tenant_id == self.tenant_id,
                KnowledgeBase.content.like("__SHOP_SETTINGS__%"),
            )
        )
        settings_row = settings_result.scalar_one_or_none()
        info = {
            "organization_name": tenant.biz_name if tenant else "Unknown",
            "hours": "Haijawekwa", "location": "Haijawekwa", "contact_phone": "Haijawekwa",
        }
        if tenant and tenant.website_url:
            info["website_url"] = tenant.website_url
        if tenant and tenant.business_description:
            info["description"] = tenant.business_description
        if settings_row:
            for line in settings_row.content.splitlines():
                if "Business Hours:" in line:
                    info["hours"] = line.split("Business Hours:", 1)[1].strip()
                elif "Location:" in line:
                    info["location"] = line.split("Location:", 1)[1].strip()
                elif "Contact Phone:" in line:
                    info["contact_phone"] = line.split("Contact Phone:", 1)[1].strip()
        return json.dumps(info)

    async def save_inquiry(
        self, topic: str, notes: str = "",
        customer_phone: str = "", customer_name: str = "",
    ) -> str:
        phone = customer_phone.strip() if customer_phone.strip() else (self.conv.customer_phone or "")
        name = customer_name.strip() if customer_name.strip() else (self.conv.customer_name or "")

        is_real_phone = (
            bool(phone) and "unknown" not in phone.lower()
            and not phone.startswith(("tg_", "fb_", "ig_", "guest_"))
        )
        if not is_real_phone:
            return json.dumps({
                "saved": False,
                "message": "Uliza namba ya simu ya mtu kwanza kabla ya kuhifadhi ombi."
            })

        if phone != self.conv.customer_phone:
            self.conv.customer_phone = phone
        if name and name != self.conv.customer_name:
            self.conv.customer_name = name

        lead = LeadEvent(
            tenant_id=self.tenant_id, conversation_id=self.conv.id,
            customer_phone=phone, customer_name=name,
            event_type="general_interest", product_name=topic,
            status="hot", customer_response=notes,
        )
        self.db.add(lead)

        identifier = name or phone
        self.db.add(Notification(
            tenant_id=self.tenant_id, type="new_lead",
            message=f"📩 Ombi jipya: {identifier} — {topic}",
            is_read=False,
        ))

        from app.sms import send_sms
        from app.models import Tenant as TenantModel
        t = (await self.db.execute(
            select(TenantModel).where(TenantModel.id == self.tenant_id)
        )).scalar_one_or_none()
        if t and t.phone:
            await send_sms(
                t.phone,
                f"📩 Ombi jipya!\nMtu: {identifier}\nSimu: {phone}\nMada: {topic}\n"
                f"Angalia: https://wakalabot.co.tz/dashboard/leads"
            )

        await self.db.commit()
        return json.dumps({"saved": True, "message": "Ombi limehifadhiwa."})

    async def escalate_to_human(self, reason: str) -> str:
        identifier = self.conv.customer_name or self.conv.customer_phone
        self.db.add(Notification(
            tenant_id=self.tenant_id, type="escalation",
            message=f"⚠️ {identifier} anahitaji msaada wa mtu: {reason}",
            is_read=False,
        ))
        return json.dumps({
            "escalated": True,
            "suggested_reply": "Samahani kwa usumbufu. Mtu atawasiliana nawe hivi karibuni."
        })

    async def log_unanswered_question(self, question: str, category: str = "other") -> str:
        from app.models import UnansweredQuestion
        self.db.add(UnansweredQuestion(
            tenant_id=self.tenant_id, question=question, category=category,
            customer_phone=self.conv.customer_phone,
        ))
        await self.db.commit()
        return json.dumps({"logged": True})