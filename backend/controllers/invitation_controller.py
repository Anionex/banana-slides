"""Invitation Code Controller - manages user invitation codes"""

import logging
from flask import Blueprint, request, current_app
from models import db, InvitationCode, SystemConfig
from utils import success_response, error_response, bad_request
from middlewares.auth import auth_required, get_current_user

logger = logging.getLogger(__name__)

invitation_bp = Blueprint(
    "invitation", __name__, url_prefix="/api/invitation"
)


@invitation_bp.route("/codes", methods=["GET"], strict_slashes=False)
@auth_required
def get_my_codes():
    """
    GET /api/invitation/codes - 获取当前用户的邀请码列表
    """
    try:
        user = get_current_user()
        codes = InvitationCode.get_user_codes(user.id)

        # 获取系统配置
        config = SystemConfig.get_instance()

        return success_response({
            'codes': [code.to_dict() for code in codes],
            'max_codes': config.max_invitation_codes,
            'invitation_bonus': config.invitation_bonus,
            'enable_invitation': config.enable_invitation,
        })
    except Exception as e:
        logger.error(f"Error getting invitation codes: {str(e)}")
        return error_response(
            "GET_CODES_ERROR",
            f"获取邀请码失败: {str(e)}",
            500,
        )


@invitation_bp.route("/codes", methods=["POST"], strict_slashes=False)
@auth_required
def create_code():
    """
    POST /api/invitation/codes - 创建新的邀请码
    """
    try:
        user = get_current_user()

        # 获取系统配置
        config = SystemConfig.get_instance()

        # 检查邀请功能是否开启
        if not config.enable_invitation:
            return error_response("INVITATION_DISABLED", "邀请功能已关闭", 403)

        # 检查用户是否已达到最大邀请码数量
        active_count = InvitationCode.get_user_active_codes_count(user.id)
        if active_count >= config.max_invitation_codes:
            return error_response(
                "MAX_CODES_REACHED",
                f"您最多可以创建 {config.max_invitation_codes} 个邀请码",
                400
            )

        # 创建新邀请码
        code = InvitationCode.create_for_user(user.id)
        db.session.commit()

        logger.info(f"User {user.id} created invitation code: {code.code}")
        return success_response(code.to_dict(), "邀请码创建成功")

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating invitation code: {str(e)}")
        return error_response(
            "CREATE_CODE_ERROR",
            f"创建邀请码失败: {str(e)}",
            500,
        )


@invitation_bp.route("/codes/<code_id>", methods=["DELETE"], strict_slashes=False)
@auth_required
def delete_code(code_id: str):
    """
    DELETE /api/invitation/codes/<code_id> - 删除邀请码（仅限未使用的）
    """
    try:
        user = get_current_user()

        code = InvitationCode.query.get(code_id)
        if not code:
            return error_response("CODE_NOT_FOUND", "邀请码不存在", 404)

        if code.inviter_id != user.id:
            return error_response("PERMISSION_DENIED", "无权删除此邀请码", 403)

        if code.status != 'active':
            return error_response("CODE_USED", "已使用的邀请码无法删除", 400)

        db.session.delete(code)
        db.session.commit()

        logger.info(f"User {user.id} deleted invitation code: {code.code}")
        return success_response(None, "邀请码已删除")

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting invitation code: {str(e)}")
        return error_response(
            "DELETE_CODE_ERROR",
            f"删除邀请码失败: {str(e)}",
            500,
        )


@invitation_bp.route("/validate/<code>", methods=["GET"], strict_slashes=False)
def validate_code(code: str):
    """
    GET /api/invitation/validate/<code> - 验证邀请码是否有效（公开接口）
    """
    try:
        invitation = InvitationCode.get_by_code(code)

        if not invitation:
            return success_response({
                'valid': False,
                'message': '邀请码不存在'
            })

        if not invitation.is_valid():
            return success_response({
                'valid': False,
                'message': '邀请码已被使用或已过期'
            })

        # 获取邀请奖励积分
        config = SystemConfig.get_instance()

        return success_response({
            'valid': True,
            'bonus': config.invitation_bonus,
            'message': f'有效邀请码，注册后双方各得 {config.invitation_bonus} 积分'
        })

    except Exception as e:
        logger.error(f"Error validating invitation code: {str(e)}")
        return error_response(
            "VALIDATE_CODE_ERROR",
            f"验证邀请码失败: {str(e)}",
            500,
        )


@invitation_bp.route("/stats", methods=["GET"], strict_slashes=False)
@auth_required
def get_invitation_stats():
    """
    GET /api/invitation/stats - 获取用户的邀请统计
    """
    try:
        user = get_current_user()

        # 统计已使用的邀请码数量
        used_count = InvitationCode.query.filter_by(
            inviter_id=user.id,
            status='used'
        ).count()

        # 获取系统配置
        config = SystemConfig.get_instance()

        # 计算总共获得的邀请奖励
        total_bonus = used_count * config.invitation_bonus

        return success_response({
            'invited_count': used_count,
            'total_bonus_earned': total_bonus,
            'bonus_per_invite': config.invitation_bonus,
        })

    except Exception as e:
        logger.error(f"Error getting invitation stats: {str(e)}")
        return error_response(
            "GET_STATS_ERROR",
            f"获取邀请统计失败: {str(e)}",
            500,
        )
