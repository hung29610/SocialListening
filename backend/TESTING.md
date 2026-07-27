# Backend tests

Use Python 3.11 for the pinned backend dependency set:

```powershell
python -m pip install -r backend/requirements-dev.txt
python -m pytest -c backend/pytest.ini backend/tests
```

The suite selects its database before importing the application:

- By default, pytest creates a temporary local SQLite database and removes it
  after the session.
- To exercise PostgreSQL-specific behavior, set `TEST_DATABASE_URL` to a
  dedicated local test database. Never point it at production.

The application service's `DATABASE_URL` is overridden only inside pytest.
