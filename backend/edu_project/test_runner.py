from django.test.runner import DiscoverRunner

class VectorTestRunner(DiscoverRunner):
    def setup_databases(self, **kwargs):
        # Create the test database
        test_db_name = super().setup_databases(**kwargs)
        
        # Connect to the test database and create the vector extension
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            
        return test_db_name
