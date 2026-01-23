"""
Logging Configuration - File-based logging for debugging
"""

import logging
import os
from datetime import datetime
from logging.handlers import RotatingFileHandler
import structlog
from structlog.contextvars import merge_contextvars

# Create logs directory if it doesn't exist
LOGS_DIR = os.path.join(os.path.dirname(__file__), 'logs')
os.makedirs(LOGS_DIR, exist_ok=True)

def setup_file_logging():
    """
    Configure file-based logging with rotation
    """
    configure_structlog()
    
    # Create formatters
    detailed_formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)-8s [%(name)s:%(funcName)s:%(lineno)d] - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    simple_formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # File handlers with rotation (10MB max, keep 5 backup files)
    
    # 1. All logs
    all_handler = RotatingFileHandler(
        os.path.join(LOGS_DIR, 'app.log'),
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5
    )
    all_handler.setLevel(logging.DEBUG)
    all_handler.setFormatter(detailed_formatter)
    
    # 2. Error logs only
    error_handler = RotatingFileHandler(
        os.path.join(LOGS_DIR, 'errors.log'),
        maxBytes=10*1024*1024,
        backupCount=5
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(detailed_formatter)
    
    # 3. Auth/token logs (custom)
    auth_handler = RotatingFileHandler(
        os.path.join(LOGS_DIR, 'auth.log'),
        maxBytes=10*1024*1024,
        backupCount=5
    )
    auth_handler.setLevel(logging.DEBUG)
    auth_handler.setFormatter(detailed_formatter)
    
    # 4. API requests log
    api_handler = RotatingFileHandler(
        os.path.join(LOGS_DIR, 'api_requests.log'),
        maxBytes=10*1024*1024,
        backupCount=5
    )
    api_handler.setLevel(logging.INFO)
    api_handler.setFormatter(simple_formatter)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)
    root_logger.addHandler(all_handler)
    root_logger.addHandler(error_handler)
    
    # Configure auth logger
    auth_logger = logging.getLogger('auth')
    auth_logger.addHandler(auth_handler)
    
    # Configure API logger
    api_logger = logging.getLogger('api')
    api_logger.addHandler(api_handler)

    # Configure dedicated errors logger to ensure 4xx/5xx entries reach errors.log
    errors_logger = logging.getLogger('errors')
    errors_logger.setLevel(logging.ERROR)
    errors_logger.addHandler(error_handler)
    
    # Also log to console
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(simple_formatter)
    root_logger.addHandler(console_handler)
    
    logging.info("=" * 70)
    logging.info("File logging initialized")
    logging.info(f"Log directory: {LOGS_DIR}")
    logging.info("=" * 70)
    
    return {
        'all': os.path.join(LOGS_DIR, 'app.log'),
        'errors': os.path.join(LOGS_DIR, 'errors.log'),
        'auth': os.path.join(LOGS_DIR, 'auth.log'),
        'api': os.path.join(LOGS_DIR, 'api_requests.log'),
    }


def get_logger(name):
    """Get a logger instance"""
    return logging.getLogger(name)


# Create specialized loggers
auth_logger = logging.getLogger('auth')
api_logger = logging.getLogger('api')
errors_logger = logging.getLogger('errors')


def configure_structlog():
    """Configure structlog for structured logging."""
    structlog.configure(
        processors=[
            merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        cache_logger_on_first_use=True,
    )


def get_struct_logger(name: str = "app"):
    """Get a structlog logger."""
    return structlog.get_logger(name)
