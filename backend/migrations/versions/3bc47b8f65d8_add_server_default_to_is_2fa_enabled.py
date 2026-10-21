"""add server_default to is_2fa_enabled

Revision ID: 3bc47b8f65d8
Revises: efe91b0ad43d
Create Date: 2026-10-21 21:03:08.840262

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3bc47b8f65d8"
down_revision: str | Sequence[str] | None = "efe91b0ad43d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "is_2fa_enabled",
        server_default=sa.text("false"),
    )


def downgrade() -> None:
    op.alter_column("users", "is_2fa_enabled", server_default=None)
