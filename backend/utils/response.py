"""
Unified response format utilities
"""
import logging
import os
import uuid
from flask import jsonify
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def success_response(data: Any = None, message: str = "Success", status_code: int = 200):
    """
    Generate a successful response
    
    Args:
        data: Response data
        message: Success message
        status_code: HTTP status code
    
    Returns:
        Flask response with JSON format
    """
    response = {
        "success": True,
        "message": message
    }
    
    if data is not None:
        response["data"] = data
    
    return jsonify(response), status_code


def error_response(error_code: str, message: str, status_code: int = 400):
    """
    Generate an error response
    
    Args:
        error_code: Error code identifier
        message: Error message
        status_code: HTTP status code
    
    Returns:
        Flask response with JSON format
    """
    error_payload = {
        "code": error_code,
        "message": message
    }

    if status_code >= 500 and os.getenv('EXPOSE_INTERNAL_ERRORS', '').lower() not in ('1', 'true', 'yes'):
        error_id = uuid.uuid4().hex[:12]
        logger.error("Internal error response hidden from client: id=%s code=%s message=%s", error_id, error_code, message)
        error_payload = {
            "code": error_code,
            "message": "Internal server error. Please retry or check backend logs.",
            "error_id": error_id,
        }

    return jsonify({
        "success": False,
        "error": error_payload
    }), status_code


# Common error responses
def bad_request(message: str = "Invalid request"):
    return error_response("INVALID_REQUEST", message, 400)


def not_found(resource: str = "Resource"):
    return error_response(f"{resource.upper()}_NOT_FOUND", f"{resource} not found", 404)


def invalid_status(message: str = "Invalid status for this operation"):
    return error_response("INVALID_PROJECT_STATUS", message, 400)


def ai_service_error(message: str = "AI service error"):
    return error_response("AI_SERVICE_ERROR", message, 503)


def rate_limit_error(message: str = "Rate limit exceeded"):
    return error_response("RATE_LIMIT_EXCEEDED", message, 429)

