import asyncio
import json
import re
import uuid
from typing import Any, Dict, Union

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Conversation, KnowledgeBase,
    LeadEvent, Product, CustomerNote, Notification,
)


# ── Tool Definitions ──────────────────────────────────────────────────────────
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_product_catalog",
            "description": "Fetch all active physical products (name and price only). Call this when customer asks 'kuna nini', 'bidhaa zote', 'orodha', 'what do you sell', 'all products'.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_service_catalog",
            "description": "Fetch all active services (name and price only). Call when customer asks 'huduma zote', 'what services', 'mnafanya nini'.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_product_by_name",
            "description": "Get full details of ONE specific product: price, stock, description, image URL. Call when customer asks about a specific product by name.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_name": {"type": "string", "description": "The product name to look up"},
                },
                "required": ["product_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_service_by_name",
            "description": "Get full details of ONE specific service: price, description, image URL. Call when customer asks about a specific service by name.",
            "parameters": {
                "type": "object",
                "properties": {
                    "service_name": {"type": "string", "description": "The service name to look up"},
                },
                "required": ["service_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_shop_info",
            "description": "Fetch business info: hours, location, contact phone, delivery zones, website, description. Call for 'mko wapi', 'mnafungua saa ngapi', 'delivery', 'contact', 'location'.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_stock",
            "description": "Check exact current stock quantity for a specific product.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_name": {"type": "string"},
                },
                "required": ["product_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_knowledge_base",
            "description": "Search knowledge base for FAQs, policies, return policy, custom business info. Use when the question is not about a specific product, service, or shop info.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_order_total",
            "description": "Calculate the total price for a quantity of a product. Use when customer specifies quantity.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_name": {"type": "string",
                                     "description": "The clean name of the product extracted from the user's input (e.g., 'Unga wa ngano')."
                                     },
                    "quantity": {"type": "string",
                                 "description": "The total count of the product requested. Can be passed as a numeric string like '1'."
                                 },
                },
                "required": ["product_name", "quantity"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_delivery_cost",
            "description": "Get delivery cost to a specific location or area.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", 
                                 "description": "The location or area to calculate delivery cost for"},
                },
                "required": ["location"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_lead",
            "description": "Save a customer purchase lead to the database. Call this ONLY after the customer has expressed clear buying intent AND you know their name. This notifies the merchant. CRITICAL: Do not call this tool until you have explicitly collected the customer's phone number and the exact product they want in the chat history. If you call this tool without a phone number or product name, it will fail and the lead will not be saved. Always confirm these details in the conversation before calling this tool.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_name": {"type": "string", "description": "Product or service the customer wants"},
                    "quantity": {"type": "string", 
                                 "description": "The total quantity of items the customer wants. Can be passed as a numeric string like '2' or '5'. Defaults to '1' if not stated."
                                 },
                    "notes": {"type": "string", "description": "Any extra info about the order"},
                    "intent_type": {
                        "type": "string",
                        "enum": ["order_intent", "appointment_intent", "price_inquiry", "general_interest"],
                    },
                },
                "required": ["product_name", "intent_type", "quantity"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_customer_note",
            "description": "Save a useful observation about this customer for the merchant. Use for delivery preferences, special requests, or anything merchant should know.",
            "parameters": {
                "type": "object",
                "properties": {
                    "note": {"type": "string"},
                },
                "required": ["note"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_customer_history",
            "description": "Get this customer's previous orders and notes. Call at start of conversation to check if returning customer.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_notification",
            "description": "Send a notification to the merchant about something important.",
            "parameters": {
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": ["new_lead", "insight", "escalation", "complaint", "new_message"],
                    },
                    "message": {"type": "string"},
                },
                "required": ["type", "message"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "escalate_to_human",
            "description": "Flag this conversation for the merchant to handle personally. Use when customer is angry, has a complex problem, or needs human assistance.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {"type": "string"},
                },
                "required": ["reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_insight",
            "description": "Save a business intelligence observation. Use for patterns like 'many customers asking about X', 'product Y never in stock when asked'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "observation": {"type": "string"},
                },
                "required": ["observation"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_business_website",
            "description": "Fetch live content from the business website. Use when customer asks about something not in KB and business has a website URL configured.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": "Search the internet for general information not in business data — commodity prices, regulations, general how-to questions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "context_restore",
            "description": "Internal tool used to restore conversation context from history. Never call this directly.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "log_unanswered_question",
            "description": "Log a question the business cannot answer because the information is not in the knowledge base. Call this when search_knowledge_base returns found=false and no product/service/shop info covers it.",
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {"type": "string", "description": "The customer's question that could not be answered"},
                    "category": {
                        "type": "string",
                        "enum": ["product_info", "service_info", "pricing", "policy", "location", "other"],
                        "description": "Category of the unanswered question"
                    }
                },
                "required": ["question", "category"],
            },
        },
    },
]


# ── Tool Executor ─────────────────────────────────────────────────────────────

class ToolExecutor:
    def __init__(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        conv: Conversation,
        embedder: Any,
        use_langchain: bool = False,
    ):
        self.db = db
        self.tenant_id = tenant_id
        self.conv = conv
        self.embedder = embedder
        self.use_langchain = use_langchain

    async def execute(self, tool_name: str, args: Dict[str, Any]) -> str:
        try:
            handler = getattr(self, tool_name, None)
            if handler is None:
                return json.dumps({"error": f"Unknown tool: {tool_name}"})
            result = await handler(**args)
            return result
        except TypeError as e:
            return json.dumps({"error": f"Invalid arguments for {tool_name}: {str(e)}"})
        except Exception as e:
            return json.dumps({"error": f"Tool {tool_name} failed: {str(e)}"})

    async def get_product_catalog(self) -> str:
        result = await self.db.execute(
            select(Product).where(
                Product.tenant_id == self.tenant_id,
                Product.is_active == True,
                Product.category == "product",
            ).order_by(Product.name)
        )
        products = result.scalars().all()
        if not products:
            return json.dumps({"found": False, "products": [], "message": "Hakuna bidhaa zilizopatikana kwa sasa."})
        return json.dumps({
            "found": True,
            "count": len(products),
            "products": [
                {
                    "name": p.name,
                    "price_tzs": float(p.price),
                    "in_stock": p.stock_quantity > 0,
                    "stock_qty": p.stock_quantity,
                }
                for p in products
            ],
        })

    async def get_service_catalog(self) -> str:
        result = await self.db.execute(
            select(Product).where(
                Product.tenant_id == self.tenant_id,
                Product.is_active == True,
                Product.category == "service",
            ).order_by(Product.name)
        )
        services = result.scalars().all()
        if not services:
            return json.dumps({"found": False, "services": [], "message": "Hakuna huduma zilizopatikana kwa sasa."})
        return json.dumps({
            "found": True,
            "count": len(services),
            "services": [
                {
                    "name": s.name,
                    "price_tzs": float(s.price),
                }
                for s in services
            ],
        })

    async def get_product_by_name(self, product_name: str) -> str:
        result = await self.db.execute(
            select(Product).where(
                Product.tenant_id == self.tenant_id,
                Product.is_active == True,
                Product.category == "product",
                Product.name.ilike(f"%{product_name}%"),
            )
        )
        product = result.scalar_one_or_none()
        if not product:
            return json.dumps({
                "found": False,
                "message": f"Bidhaa '{product_name}' haikupatikana katika mfumo. Jibu kwa mtumiaji kwamba bidhaa hiyo haipo."
            })
        return json.dumps({
            "found": True,
            "name": product.name,
            "price_tzs": float(product.price),
            "stock": product.stock_quantity,
            "in_stock": product.stock_quantity > 0,
            "description": product.description or "",
            "image_url": product.image_url,
        })

    async def get_service_by_name(self, service_name: str) -> str:
        result = await self.db.execute(
            select(Product).where(
                Product.tenant_id == self.tenant_id,
                Product.is_active == True,
                Product.category == "service",
                Product.name.ilike(f"%{service_name}%"),
            )
        )
        service = result.scalar_one_or_none()
        if not service:
            return json.dumps({
                "found": False,
                "message": f"Huduma '{service_name}' haikupatikana. Jibu kwa mtumiaji kwamba huduma hiyo haipo."
            })
        return json.dumps({
            "found": True,
            "name": service.name,
            "price_tzs": float(service.price),
            "description": service.description or "",
            "image_url": service.image_url,
        })

    async def get_shop_info(self) -> str:
        from app.models import Tenant
        tenant_result = await self.db.execute(
            select(Tenant).where(Tenant.id == self.tenant_id)
        )
        tenant = tenant_result.scalar_one_or_none()

        settings_result = await self.db.execute(
            select(KnowledgeBase).where(
                KnowledgeBase.tenant_id == self.tenant_id,
                KnowledgeBase.content.like("__SHOP_SETTINGS__%"),
            )
        )
        settings_row = settings_result.scalar_one_or_none()

        info: Dict[str, Any] = {
            "business_name": tenant.biz_name if tenant else "Unknown",
            "hours": "Haijawekwa",
            "location": "Haijawekwa",
            "contact_phone": "Haijawekwa",
        }

        if tenant:
            if getattr(tenant, "website_url", None):
                info["website_url"] = tenant.website_url
            if getattr(tenant, "delivery_zones", None):
                info["delivery_zones"] = tenant.delivery_zones
            if getattr(tenant, "business_description", None):
                info["business_description"] = tenant.business_description

        if settings_row:
            for line in settings_row.content.splitlines():
                if "Business Hours:" in line:
                    info["hours"] = line.split("Business Hours:", 1)[1].strip()
                elif "Location:" in line:
                    info["location"] = line.split("Location:", 1)[1].strip()
                elif "Contact Phone:" in line:
                    info["contact_phone"] = line.split("Contact Phone:", 1)[1].strip()

        return json.dumps(info)

    async def check_stock(self, product_name: str) -> str:
        result = await self.db.execute(
            select(Product).where(
                Product.tenant_id == self.tenant_id,
                Product.is_active == True,
                Product.name.ilike(f"%{product_name}%"),
            )
        )
        product = result.scalar_one_or_none()
        if not product:
            return json.dumps({
                "found": False,
                "message": f"Bidhaa '{product_name}' haikupatikana."
            })
        return json.dumps({
            "found": True,
            "name": product.name,
            "stock": product.stock_quantity,
            "in_stock": product.stock_quantity > 0,
            "price_tzs": float(product.price),
        })

    async def search_knowledge_base(self, query: str) -> str:
        try:
            if self.use_langchain:
                emb = await asyncio.to_thread(self.embedder.embed_query, query)
            else:
                vec = await asyncio.to_thread(
                    self.embedder.encode, query, show_progress_bar=False
                )
                emb = vec.tolist() if hasattr(vec, "tolist") else list(vec)
        except Exception:
            return json.dumps({"found": False, "message": "KB search unavailable."})

        stmt = (
            select(KnowledgeBase)
            .where(
                KnowledgeBase.tenant_id == self.tenant_id,
                KnowledgeBase.content.not_like("__SHOP_SETTINGS__%"),
            )
            .order_by(KnowledgeBase.embedding.cosine_distance(emb))
            .limit(3)
        )
        result = await self.db.execute(stmt)
        docs = result.scalars().all()
        if not docs:
            return json.dumps({
                "found": False,
                "message": "Hakuna taarifa zilizopatikana kwenye mfumo kuhusu swali hilo."
            })
        return json.dumps({
            "found": True,
            "results": [
                {"content": d.content, "image_url": d.image_url}
                for d in docs
            ],
        })

    async def calculate_order_total(self, product_name: str, quantity: Union[int, str]) -> str:

        qty_int = int(quantity)

        result = await self.db.execute(
            select(Product).where(
                Product.tenant_id == self.tenant_id,
                Product.is_active == True,
                Product.name.ilike(f"%{product_name}%"),
            )
        )
        product = result.scalar_one_or_none()
        if not product:
            return json.dumps({"found": False, "message": f"Bidhaa '{product_name}' haikupatikana."})
        if product.category == "product" and product.stock_quantity < qty_int:
            return json.dumps({
                "can_fulfill": False,
                "available": product.stock_quantity,
                "message": f"Zimebaki {product.stock_quantity} tu. Haiwezekani kutoa {qty_int}.",
            })
        total = float(product.price) * qty_int
        return json.dumps({
            "found": True,
            "can_fulfill": True,
            "product": product.name,
            "unit_price_tzs": float(product.price),
            "quantity": qty_int,
            "total_tzs": total,
            "formatted_total": f"{total:,.0f} TZS",
        })

    async def calculate_delivery_cost(self, location: str) -> str:
        from app.models import Tenant
        tenant_result = await self.db.execute(
            select(Tenant).where(Tenant.id == self.tenant_id)
        )
        tenant = tenant_result.scalar_one_or_none()
        if not tenant or not getattr(tenant, "delivery_zones", None):
            return json.dumps({
                "available": False,
                "message": "Delivery zones hazijawekwa na biashara hii."
            })
        location_lower = location.lower()
        for line in tenant.delivery_zones.splitlines():
            if "-" in line:
                parts = line.split("-", 1)
                zone = parts[0].strip().lower()
                if zone in location_lower or location_lower in zone:
                    return json.dumps({
                        "available": True,
                        "zone": parts[0].strip(),
                        "cost": parts[1].strip(),
                    })
        return json.dumps({
            "available": True,
            "all_zones": tenant.delivery_zones,
            "message": "Eneo halikusanidiwa moja kwa moja. Hapa ni maeneo yote yaliyowekwa.",
        })

    async def save_lead(
        self,
        product_name: str,
        intent_type: str = "order_intent",
        quantity: Union[int, str] = "1",
        notes: str = "",
    ) -> str:
        try:
            qty_int = int(quantity)
        except (ValueError, TypeError):
            qty_int = 1

        existing = await self.db.execute(
            select(LeadEvent).where(
                LeadEvent.conversation_id == self.conv.id,
                LeadEvent.status.in_(["pending", "hot"]),
            ).limit(1)
        )
        if existing.scalar_one_or_none():
            return json.dumps({"saved": False, "message": "Lead tayari ipo kwa mazungumzo haya."})
        
        # 1. Guard against missing or placeholder phone numbers
        phone = self.conv.customer_phone
        if not phone or phone.strip() == "" or "unknown" in phone.lower():
            return json.dumps({
                "saved": False, 
                "message": "Huwezi kuhifadhi lead bila namba ya simu ya mteja. Tafadhali omba namba ya simu ya mteja kwanza kabla ya kuita tool hii."
            })

        # 2. Guard against vague product details
        if not product_name or product_name.strip() == "":
            return json.dumps({
                "saved": False,
                "message": "Jina la bidhaa halijapatikana. Uliza mteja bidhaa gani anayotaka kabla ya kuhifadhi lead."
            })

        lead = LeadEvent(
            tenant_id=self.tenant_id,
            conversation_id=self.conv.id,
            customer_phone=self.conv.customer_phone,
            customer_name=self.conv.customer_name,
            event_type=intent_type,
            product_name=product_name,
            status="hot",
            customer_response=f"qty:{qty_int}" + (f" | {notes}" if notes else ""),
        )
        self.db.add(lead)

        customer_id = self.conv.customer_name or self.conv.customer_phone
        self.db.add(Notification(
            tenant_id=self.tenant_id,
            type="new_lead",
            message=(
                f"🔥 Lead mpya: {customer_id} anataka {product_name}"
                + (f" x{qty_int}" if qty_int > 1 else "")
            ),
            is_read=False,
        ))
        await self.db.commit()
        return json.dumps({"saved": True, "message": "Lead imehifadhiwa. Merchant amearifiwa."})

    async def save_customer_note(self, note: str) -> str:
        self.db.add(CustomerNote(
            tenant_id=self.tenant_id,
            conversation_id=self.conv.id,
            customer_phone=self.conv.customer_phone,
            content=note,
        ))
        return json.dumps({"saved": True})

    async def get_customer_history(self) -> str:
        leads_result = await self.db.execute(
            select(LeadEvent).where(
                LeadEvent.tenant_id == self.tenant_id,
                LeadEvent.customer_phone == self.conv.customer_phone,
            ).order_by(LeadEvent.created_at.desc()).limit(5)
        )
        leads = leads_result.scalars().all()

        notes_result = await self.db.execute(
            select(CustomerNote).where(
                CustomerNote.tenant_id == self.tenant_id,
                CustomerNote.customer_phone == self.conv.customer_phone,
            ).order_by(CustomerNote.created_at.desc()).limit(5)
        )
        notes = notes_result.scalars().all()

        is_returning = len(leads) > 0 or len(notes) > 0
        return json.dumps({
            "is_returning_customer": is_returning,
            "customer_name": self.conv.customer_name,
            "previous_leads": [
                {"product": l.product_name, "status": l.status}
                for l in leads
            ],
            "notes": [n.content for n in notes],
        })

    async def create_notification(self, type: str, message: str) -> str:
        self.db.add(Notification(
            tenant_id=self.tenant_id,
            type=type,
            message=message,
            is_read=False,
        ))
        return json.dumps({"created": True})

    async def escalate_to_human(self, reason: str) -> str:
        customer_id = self.conv.customer_name or self.conv.customer_phone
        self.db.add(Notification(
            tenant_id=self.tenant_id,
            type="escalation",
            message=f"⚠️ {customer_id} anahitaji msaada wa mtu: {reason}",
            is_read=False,
        ))
        self.db.add(CustomerNote(
            tenant_id=self.tenant_id,
            conversation_id=self.conv.id,
            customer_phone=self.conv.customer_phone,
            content=f"[ESCALATED] {reason}",
        ))
        return json.dumps({
            "escalated": True,
            "suggested_reply": "Samahani kwa usumbufu. Mwakilishi wetu atawasiliana nawe hivi karibuni.",
        })

    async def generate_insight(self, observation: str) -> str:
        self.db.add(Notification(
            tenant_id=self.tenant_id,
            type="insight",
            message=f"💡 {observation}",
            is_read=False,
        ))
        self.db.add(CustomerNote(
            tenant_id=self.tenant_id,
            conversation_id=self.conv.id,
            customer_phone=self.conv.customer_phone,
            content=f"[INSIGHT] {observation}",
        ))
        return json.dumps({"saved": True})

    async def fetch_business_website(self) -> str:
        import httpx
        from app.models import Tenant
        tenant_result = await self.db.execute(
            select(Tenant).where(Tenant.id == self.tenant_id)
        )
        tenant = tenant_result.scalar_one_or_none()
        if not tenant or not getattr(tenant, "website_url", None):
            return json.dumps({"available": False, "message": "Website URL haijawekwa."})
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(tenant.website_url)
                text = re.sub(r"<[^>]+>", " ", resp.text)
                text = re.sub(r"\s+", " ", text).strip()[:3000]
            return json.dumps({"available": True, "url": tenant.website_url, "content": text})
        except Exception as e:
            return json.dumps({"available": False, "message": f"Imeshindwa kupakua: {str(e)}"})

    async def search_web(self, query: str) -> str:
        import httpx
        try:
            search_url = f"https://lite.duckduckgo.com/lite/?q={query.replace(' ', '+')}"
            async with httpx.AsyncClient(
                timeout=10.0,
                headers={"User-Agent": "Mozilla/5.0 WakalaBot/1.0"},
                follow_redirects=True,
            ) as client:
                resp = await client.get(search_url)
                text = re.sub(r"<[^>]+>", " ", resp.text)
                text = re.sub(r"\s+", " ", text).strip()[:2000]
            return json.dumps({"found": True, "results": text})
        except Exception as e:
            return json.dumps({"found": False, "error": f"Search failed: {str(e)}"})
        
    async def log_unanswered_question(self, question: str, category: str = "other") -> str:
        from app.models import UnansweredQuestion
        self.db.add(UnansweredQuestion(
            tenant_id=self.tenant_id,
            question=question,
            category=category,
            customer_phone=self.conv.customer_phone,
        ))
        return json.dumps({"logged": True})
        
    async def context_restore(self) -> str:
        return json.dumps({"restored": True})