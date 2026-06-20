"""
sqladmin configuration — automated CRUD panel mounted at /sqladmin.

Access at http://localhost:8000/sqladmin
Login with SUPERADMIN_SECRET from .env as the password (username: admin).
"""
from sqladmin import Admin, ModelView # type: ignore
from sqladmin.authentication import AuthenticationBackend # type: ignore
from starlette.requests import Request

from app.core import settings
from app.db import engine
from app.models import SupportTicket, Tenant, Transaction, Wallet


class _SuperAdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        if (
            form.get("username") == "admin"
            and form.get("password") == settings.SUPERADMIN_SECRET
        ):
            request.session.update({"sa_token": "ok"})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return request.session.get("sa_token") == "ok"


class TenantAdmin(ModelView, model=Tenant):
    name = "Tenant"
    name_plural = "Tenants"
    icon = "fa-solid fa-building"
    column_list = [
        Tenant.id,
        Tenant.biz_name,
        Tenant.email,
    ]
    column_searchable_list = [Tenant.email, Tenant.biz_name]
    column_sortable_list = [Tenant.email, Tenant.biz_name]
    column_details_exclude_list = [Tenant.hashed_password]
    form_excluded_columns = [
        Tenant.hashed_password,
        Tenant.wallet,
        Tenant.knowledge_base,
        Tenant.products,
        Tenant.conversations,
        Tenant.support_tickets,
    ]
    can_create = False  # Use /register endpoint; prevent plain-text password storage
    can_edit = True
    can_delete = True
    can_export = True


class WalletAdmin(ModelView, model=Wallet):
    name = "Wallet"
    name_plural = "Wallets"
    icon = "fa-solid fa-wallet"
    column_list = [Wallet.id, Wallet.tenant_id, Wallet.balance, Wallet.last_updated]
    column_sortable_list = [Wallet.balance, Wallet.last_updated]
    can_create = False
    can_delete = False


class TransactionAdmin(ModelView, model=Transaction):
    name = "Transaction"
    name_plural = "Transactions"
    icon = "fa-solid fa-receipt"
    column_list = [
    Transaction.id,
    Transaction.tenant_id,
    Transaction.coin_amount,
    Transaction.tx_type,
    Transaction.prompt_tokens,
    Transaction.completion_tokens,
    Transaction.usd_cost,
    Transaction.amount_tzs,
    Transaction.package_id,
    Transaction.note,
    Transaction.created_at,
]
    column_searchable_list = [Transaction.package_id]
    column_sortable_list = [Transaction.created_at, Transaction.coin_amount]
    can_create = False
    can_edit = False
    can_delete = True
    can_export = True


class SupportTicketAdmin(ModelView, model=SupportTicket):
    name = "Support Ticket"
    name_plural = "Support Tickets"
    icon = "fa-solid fa-ticket"
    column_list = [
        SupportTicket.id,
        SupportTicket.tenant_id,
        SupportTicket.subject,
        SupportTicket.category,
        SupportTicket.status,
        SupportTicket.created_at,
    ]
    column_searchable_list = [SupportTicket.subject]
    column_sortable_list = [SupportTicket.created_at, SupportTicket.status]
    can_create = False
    can_edit = True
    can_delete = True
    can_export = True


def mount_admin(app) -> Admin:
    auth_backend = _SuperAdminAuth(secret_key=settings.JWT_SECRET_KEY)
    admin = Admin(app, engine, authentication_backend=auth_backend)
    admin.add_view(TenantAdmin)
    admin.add_view(WalletAdmin)
    admin.add_view(TransactionAdmin)
    admin.add_view(SupportTicketAdmin)
    return admin
