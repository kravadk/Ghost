import React from "react";

interface PermissionAlertProps {
    hasPermission: boolean | null;
    onReconnect: () => void;
}

export const PermissionAlert: React.FC<PermissionAlertProps> = ({
    hasPermission,
    onReconnect,
}) => {
    if (hasPermission !== false) return null;

    return (
        <div style={{
            padding: "16px",
            marginBottom: "16px",
            backgroundColor: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: "8px",
            color: "#856404",
            maxWidth: "600px",
            margin: "0 auto 16px auto"
        }}>
            <div style={{ fontWeight: "bold", marginBottom: "8px", fontSize: "16px" }}>
                ⚠️ Обмежений доступ до гаманця
            </div>
            <div style={{ marginBottom: "12px", lineHeight: "1.5" }}>
                Для швидкої синхронізації повідомлень потрібен доступ до <strong>On-Chain History</strong>.
                Без цього буде використано повільне сканування блоків (~5-10 секунд).
            </div>
            <button
                onClick={onReconnect}
                style={{
                    padding: "8px 16px",
                    backgroundColor: "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "500"
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = "#0056b3";
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = "#007bff";
                }}
            >
                Переподключити з вищим рівнем доступу
            </button>
        </div>
    );
};

