from alembic import context

from observatorio.db import motor

with motor().begin() as conexao:
    context.configure(connection=conexao, target_metadata=None)
    with context.begin_transaction():
        context.run_migrations()
