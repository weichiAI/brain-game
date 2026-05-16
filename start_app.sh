#!/bin/bash
# ============================================
# 全栈项目启动脚本（workflow 版）
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_ENV_FILE="${SCRIPT_DIR}/.imagicma/runtime.env"

if [ -z "${PORT:-}" ] && [ -f "${RUNTIME_ENV_FILE}" ]; then
    set -a
    # shellcheck disable=SC1090
    . "${RUNTIME_ENV_FILE}"
    set +a
fi

if [ -z "${PORT:-}" ]; then
    echo "错误: 缺少 PORT；请先提供环境变量 PORT 或项目内 .imagicma/runtime.env"
    exit 1
fi

if ! [[ "${PORT}" =~ ^[0-9]+$ ]] || [ "${PORT}" -le 0 ] || [ "${PORT}" -gt 65535 ]; then
    echo "错误: 非法 PORT 值: ${PORT}"
    exit 1
fi

if ! command -v process-compose >/dev/null 2>&1; then
    echo "错误: 未安装 process-compose"
    exit 1
fi

CONFIG_FILE=""
if [ -f "${SCRIPT_DIR}/process-compose.yaml" ]; then
    CONFIG_FILE="${SCRIPT_DIR}/process-compose.yaml"
elif [ -f "${SCRIPT_DIR}/process-compose.yml" ]; then
    CONFIG_FILE="${SCRIPT_DIR}/process-compose.yml"
else
    echo "错误: 未找到 process-compose 配置文件"
    exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
    CONFIG_HASH="$(printf '%s' "${CONFIG_FILE}" | sha256sum | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
    CONFIG_HASH="$(printf '%s' "${CONFIG_FILE}" | shasum -a 256 | awk '{print $1}')"
else
    echo "错误: 缺少 sha256sum/shasum，无法计算 process-compose 守护端口"
    exit 1
fi

HASH_PREFIX="${CONFIG_HASH:0:8}"
HASH_VALUE=$((16#${HASH_PREFIX}))
DAEMON_PORT=$((19000 + HASH_VALUE % 10000))
CONFIG_HOME="/tmp/imagicma-process-compose/${DAEMON_PORT}"

mkdir -p "${CONFIG_HOME}/process-compose"

export PC_PORT_NUM="${DAEMON_PORT}"
export XDG_CONFIG_HOME="${CONFIG_HOME}"
export IMAGICMA_ALLOW_SCRIPT_LAUNCH="1"
export PORT
if [ -z "${HOME:-}" ]; then
    export HOME="${CONFIG_HOME}"
fi

echo "========================================"
echo "启动全栈项目 workflow"
echo "项目目录: ${SCRIPT_DIR}"
echo "配置文件: ${CONFIG_FILE}"
echo "端口: ${PORT}"
echo "守护端口: ${DAEMON_PORT}"
echo "========================================"

cd "${SCRIPT_DIR}"
process-compose -f "${CONFIG_FILE}" up -D

echo "workflow 启动命令已执行"
echo "预览地址: https://${PORT}.preview.imagicma.cn"
