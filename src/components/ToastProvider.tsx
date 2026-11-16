"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ToastAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  room_name?: string;
  building_name?: string;
  floor_name?: string;
  timestamp: number;
  visible: boolean; // controls slide-in/out
}

// ─── Config ───────────────────────────────────────────────────────────────────
const TOAST_DURATION_MS = 6000;  // auto-dismiss after 6 seconds
const TOAST_ANIM_MS     = 400;   // slide-out animation duration
const MAX_TOASTS        = 5;     // max toasts shown at once

// ─── Icon / colour helpers ────────────────────────────────────────────────────
function toastMeta(type: string, severity: string) {
  if (type === "AC_WASTE")    return { icon: "❄️", accent: "#38bdf8", label: "AC Waste"    };
  if (type === "LIGHT_WASTE") return { icon: "💡", accent: "#f5b731", label: "Light Waste" };
  if (severity === "HIGH")    return { icon: "🔴", accent: "#ef5350", label: type.replace(/_/g, " ") };
  if (severity === "MEDIUM")  return { icon: "⚠️", accent: "#f5b731", label: type.replace(/_/g, " ") };
  return                             { icon: "ℹ️", accent: "#00ADB5", label: type.replace(/_/g, " ") };
}

// ─── Single Toast Card ─────────────────────────────────────────────────────────
function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastAlert;
  onDismiss: (id: string) => void;
}) {
  const { icon, accent, label } = toastMeta(toast.type, toast.severity);
  const timeStr = new Date(toast.timestamp).toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 16px",
        background: "#1E2025",
        border: `1px solid ${accent}44`,
        borderLeft: `4px solid ${accent}`,
        borderRadius: 14,
        boxShadow: `0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px ${accent}22`,
        width: 340,
        position: "relative",
        animation: toast.visible
          ? "toast-in 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards"
          : "toast-out 0.35s ease-in forwards",
        cursor: "default",
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: `${accent}18`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18,
        }}
      >
        {icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>{label}</span>
          {toast.room_name && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
              <span
                style={{
                  fontSize: 9, fontWeight: 600,
                  color: "var(--text-secondary)",
                  background: "#2B2E35",
                  padding: "2px 6px", borderRadius: 4,
                  border: "1px solid #48505B",
                  whiteSpace: "nowrap",
                }}
              >
                🚪 {toast.room_name}
              </span>
              {toast.building_name && (
                <span
                  style={{
                    fontSize: 9, fontWeight: 600,
                    color: "var(--text-secondary)",
                    background: "#2B2E35",
                    padding: "2px 6px", borderRadius: 4,
                    border: "1px solid #48505B",
                    whiteSpace: "nowrap",
                  }}
                >
                  🏢 {toast.building_name.split(" ")[0]}
                </span>
              )}
              {toast.floor_name && (
                <span
                  style={{
                    fontSize: 9, fontWeight: 600,
                    color: "var(--text-secondary)",
                    background: "#2B2E35",
                    padding: "2px 6px", borderRadius: 4,
                    border: "1px solid #48505B",
                    whiteSpace: "nowrap",
                  }}
                >
                  📶 {toast.floor_name}
                </span>
              )}
            </div>
          )}
        </div>
        <p style={{ fontSize: 12, color: "#c5c5c5", lineHeight: 1.5, margin: 0 }}>
          {toast.message}
        </p>
        <span style={{ fontSize: 10, color: "#8a8f98", marginTop: 6, display: "block" }}>
          {timeStr}
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          position: "absolute", bottom: 0, left: 4, right: 4,
          height: 3, borderRadius: "0 0 10px 10px", overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            background: accent,
            animation: `toast-progress ${TOAST_DURATION_MS}ms linear forwards`,
            transformOrigin: "left",
          }}
        />
      </div>

      {/* Close button */}
      <button
        onClick={() => onDismiss(toast.id)}
        style={{
          position: "absolute", top: 10, right: 10,
          width: 22, height: 22, borderRadius: "50%",
          background: "transparent",
          border: "1px solid #48505B",
          color: "#8a8f98", fontSize: 12,
          cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center",
          transition: "all 0.2s",
          lineHeight: 1,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#48505B";
          e.currentTarget.style.color = "#EEEEEE";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "#8a8f98";
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ─── Provider (global, mount in layout) ──────────────────────────────────────
export default function ToastProvider() {
  const [toasts, setToasts] = useState<ToastAlert[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    // Trigger slide-out animation first
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, visible: false } : t))
    );
    // Remove from DOM after animation
    const t = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_ANIM_MS);
    timersRef.current.set(`remove-${id}`, t);
  }, []);

  const addToast = useCallback(
    (anomaly: {
      anomaly_id: string;
      type: string;
      severity: string;
      message: string;
      room_name?: string;
      building_name?: string;
      floor_name?: string;
    }) => {
      const id = anomaly.anomaly_id;

      // Don't add duplicate if it already exists
      setToasts((prev) => {
        if (prev.some((t) => t.id === id)) return prev;

        const next: ToastAlert = {
          id,
          type:          anomaly.type,
          severity:      anomaly.severity,
          message:       anomaly.message,
          room_name:     anomaly.room_name,
          building_name: anomaly.building_name,
          floor_name:    anomaly.floor_name,
          timestamp:     Date.now(),
          visible:       true,
        };

        // Cap at MAX_TOASTS
        const updated = [next, ...prev].slice(0, MAX_TOASTS);

        // Auto-dismiss after duration
        const timer = setTimeout(() => dismiss(id), TOAST_DURATION_MS);
        timersRef.current.set(id, timer);

        return updated;
      });
    },
    [dismiss]
  );

  const activeAlertStates = useRef<Record<string, { light_waste: boolean; ac_waste: boolean }>>({});

  // ── Supabase Realtime: listen to new sensor_readings inserts ────────────────
  useEffect(() => {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    console.log("ToastProvider: Initializing Supabase Realtime subscription for sensor_readings...");
    const client = createClient(url, key);

    const channel = client
      .channel("toast-sensor-readings")
      .on(
        "postgres_changes" as never,
        { event: "INSERT", schema: "public", table: "sensor_readings" },
        async (payload: { new: Record<string, unknown> }) => {
          const reading = payload.new as {
            id: number;
            room_id: string;
            temp: number | null;
            noise_level: number | null;
            is_occupied: boolean | null;
            light_status: boolean | null;
            created_at: string;
          };

          console.log("ToastProvider: Realtime sensor reading INSERT event:", reading);

          const { room_id, temp, is_occupied, light_status } = reading;
          if (!room_id) return;

          // Determine current waste status
          const currentLightWaste = is_occupied === false && light_status === true;
          const currentAcWaste    = is_occupied === false && temp !== null && temp < 26.0;

          console.log(`ToastProvider room ${room_id}: is_occupied=${is_occupied}, temp=${temp}, light_status=${light_status}. Alerts: light_waste=${currentLightWaste}, ac_waste=${currentAcWaste}`);

          // Initialize state for this room if not present
          if (!activeAlertStates.current[room_id]) {
            activeAlertStates.current[room_id] = { light_waste: false, ac_waste: false };
          }

          const prev = activeAlertStates.current[room_id];

          // Fetch room name, building name, and floor name if needed
          let room_name: string | undefined;
          let building_name: string | undefined;
          let floor_name: string | undefined;
          if (currentLightWaste || currentAcWaste) {
            const { data } = await client
              .from("rooms")
              .select("name, buildings(name), floors(name)")
              .eq("room_id", room_id)
              .maybeSingle();
            if (data) {
              room_name = data.name;
              building_name = (data.buildings as any)?.name;
              floor_name = (data.floors as any)?.name;
            }
          }

          // Trigger Light Waste toast on transition from false -> true
          if (currentLightWaste && !prev.light_waste) {
            console.log(`ToastProvider triggering Light Waste toast for ${room_name || room_id}`);
            prev.light_waste = true;
            addToast({
              anomaly_id: `light-waste-${room_id}-${Date.now()}`,
              type: "LIGHT_WASTE",
              severity: "MEDIUM",
              message: `Room is vacant but lights are ON. Turn off lights to save energy.`,
              room_name,
              building_name,
              floor_name,
            });
          } else if (!currentLightWaste && prev.light_waste) {
            console.log(`ToastProvider clearing Light Waste alert for ${room_name || room_id}`);
            // Clear light waste state
            prev.light_waste = false;
          }

          // Trigger AC Waste toast on transition from false -> true
          if (currentAcWaste && !prev.ac_waste) {
            console.log(`ToastProvider triggering AC Waste toast for ${room_name || room_id}`);
            prev.ac_waste = true;
            addToast({
              anomaly_id: `ac-waste-${room_id}-${Date.now()}`,
              type: "AC_WASTE",
              severity: "HIGH",
              message: `Room is vacant but AC is ON (temperature is ${temp?.toFixed(1)}°C < 26°C).`,
              room_name,
              building_name,
              floor_name,
            });
          } else if (!currentAcWaste && prev.ac_waste) {
            console.log(`ToastProvider clearing AC Waste alert for ${room_name || room_id}`);
            // Clear AC waste state
            prev.ac_waste = false;
          }
        }
      );

    channel.subscribe((status) => {
      console.log("ToastProvider: Realtime subscription status:", status);
    });

    return () => {
      client.removeChannel(channel);
      timersRef.current.forEach((t) => clearTimeout(t));
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <>
      {/* ── Keyframe styles injected once ── */}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(110%) scale(0.92); }
          to   { opacity: 1; transform: translateX(0)  scale(1);    }
        }
        @keyframes toast-out {
          from { opacity: 1; transform: translateX(0)  scale(1);    }
          to   { opacity: 0; transform: translateX(110%) scale(0.9); }
        }
        @keyframes toast-progress {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>

      {/* ── Stack container – bottom-right ── */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: "auto" }}>
            <Toast toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </>
  );
}
