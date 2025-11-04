"""
Python worker service example file.

This file is in the services/worker scope and gets Python-specific rules.
"""

from typing import Dict, List, Optional


def process_data(data: Dict[str, any]) -> bool:
    """
    Process incoming data and return success status.
    
    Good: Type hints for parameters and return (python.type-hints)
    Good: Docstring for public function (python.docstrings)
    
    Args:
        data: Dictionary containing data to process
        
    Returns:
        True if processing succeeded, False otherwise
    """
    try:
        # Process the data
        result = validate_data(data)
        if result:
            store_data(data)
            return True
        return False
    except Exception as e:
        print(f"Error processing data: {e}")
        return False


def validate_data(data: Dict[str, any]) -> bool:
    """Validate data structure and contents."""
    required_fields = ['id', 'timestamp', 'payload']
    return all(field in data for field in required_fields)


def store_data(data: Dict[str, any]) -> None:
    """Store validated data to database."""
    # Implementation here
    pass


if __name__ == '__main__':
    sample_data = {
        'id': '123',
        'timestamp': '2025-01-15T10:00:00Z',
        'payload': {'value': 42}
    }
    success = process_data(sample_data)
    print(f"Processing {'succeeded' if success else 'failed'}")

