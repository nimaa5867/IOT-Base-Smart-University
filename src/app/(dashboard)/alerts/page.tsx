"use client";

import { useEffect, useState, useCallback } from "react";
import { useRealtime } from "@/hooks/useRealtime";

/* ─── Types ─── */
interface Anomaly {
  anomaly_id: string;
  type: string;
  severity: string;
  message: string;
  is_active: boolean;
  start_at: string;
  end_at: string | null;
  room_id: string | null;
  node_id: string | null;
  rooms: {
    name: string;
    code: string;
    buildings?: { name: string } | null;
    floors?: { name: string; level: number } | null;
  } | null;
}

interface RoomStatus {
  occupancy: "OCCUPIED" | "EMPTY" | null;
  temperature_c: number | null;
  noise_db: number | null;
  light_lux: number | null;
  ghost_cooling_active: boolean | null;
  last_sensor_reading_at: string | null;
  is_stale: boolean;
  humidity?: number | null;
  light_status?: boolean | null;
  ac_status?: boolean | null;
}

interface Room {
  room_id: string;
  name: string;
  code: string | null;
  type: string;
  building_id: string;
  room_status: RoomStatus | null;
}

interface Building {
  building_id: string;
  name: string;
}

/* ─── Helper: Sensor mini-chip ─── */
function SensorChip({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "10px 14px",
        background: "var(--bg-surface)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-color)",
        minWidth: 72,
        flex: "1 1 72px",
      }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: color ?? "var(--text-primary)",
          lineHeight: 1.2,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
      <span
        style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}
      >
        {label}
      </span>
    </div>
  );
}

/* ─── Room Card ─── */
function RoomCard({ room }: { room: Room }) {
  const status = room.room_status;
  const isOccupied = status?.occupancy === "OCCUPIED";
  const isStale = status?.is_stale ?? true;
  const hasData = status && !isStale;
  const isLightWaste = !isOccupied && status?.light_status === true;
  const isAcWaste    = !isOccupied && status?.ac_status === true;
  const isAnyWaste   = isLightWaste || isAcWaste;

  const lastSeen = status?.last_sensor_reading_at
    ? new Date(status.last_sensor_reading_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  const typeColor =
    room.type === "LAB"
      ? "blue"
      : room.type === "HALL"
      ? "green"
      : room.type === "OFFICE"
      ? "amber"
      : "blue";

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${
          isAnyWaste
            ? "rgba(239,68,68,0.35)"
            : isOccupied
            ? "rgba(0,212,161,0.25)"
            : "var(--border-color)"
        }`,
        borderRadius: "var(--radius-lg)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        transition: "all 0.25s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Waste warning stripe */}
      {isAnyWaste && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg, #ef5350, #f59e0b)",
          }}
        />
      )}

      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {room.name}
          </div>
          {room.code && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                fontFamily: "monospace",
                marginTop: 2,
              }}
            >
              {room.code}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
          <span className={`badge ${typeColor}`} style={{ fontSize: 10, padding: "3px 8px" }}>
            {room.type}
          </span>
          <span
            className={`badge ${isOccupied ? "green" : "blue"}`}
            style={{ fontSize: 10, padding: "3px 8px" }}
          >
            <span className="badge-dot" />
            {isOccupied ? "Occupied" : "Vacant"}
          </span>
        </div>
      </div>

      {/* Waste warnings */}
      {isAcWaste && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            background: "rgba(239,68,68,0.08)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(239,68,68,0.15)",
          }}
        >
          <span style={{ fontSize: 14 }}>❄️</span>
          <span style={{ fontSize: 11, color: "var(--accent-red)", fontWeight: 600 }}>
            AC Waste — Room vacant but AC running (temp &lt; 26°C)
          </span>
        </div>
      )}
      {isLightWaste && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            background: "rgba(245,158,11,0.08)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(245,158,11,0.2)",
          }}
        >
          <span style={{ fontSize: 14 }}>💡</span>
          <span style={{ fontSize: 11, color: "var(--accent-amber)", fontWeight: 600 }}>
            Light Waste — Room vacant but lights ON (LDR &lt; 2000)
          </span>
        </div>
      )}

      {/* Sensor chips */}
      {hasData ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          <SensorChip
            icon="🌡️"
            label="Temp"
            value={
              status!.temperature_c != null
                ? `${status!.temperature_c.toFixed(1)}°C`
                : "—"
            }
            color={
              status!.temperature_c != null && status!.temperature_c > 30
                ? "var(--accent-red)"
                : status!.temperature_c != null && status!.temperature_c > 26
                ? "var(--accent-amber)"
                : "var(--accent-green)"
            }
          />
          <SensorChip
            icon="🔊"
            label="Noise"
            value={
              status!.noise_db != null
                ? `${Math.round(status!.noise_db)} dB`
                : "—"
            }
            color={
              status!.noise_db != null && status!.noise_db > 60
                ? "var(--accent-amber)"
                : undefined
            }
          />
          <SensorChip
            icon="💡"
            label="Light"
            value={
              status!.light_lux != null
                ? status!.light_lux > 0
                  ? "ON"
                  : "OFF"
                : "—"
            }
            color={
              status!.light_lux != null && status!.light_lux > 0
                ? "var(--accent-amber)"
                : "var(--text-muted)"
            }
          />
          <SensorChip
            icon="❄️"
            label="AC"
            value={status!.ac_status != null ? (status!.ac_status ? "ON" : "OFF") : "—"}
            color={
              status!.ac_status === true
                ? "#38bdf8"
                : "var(--text-muted)"
            }
          />
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-md)",
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          <span>📡</span>
          <span>
            {isStale && status?.last_sensor_reading_at
              ? "Sensor data is stale"
              : "No sensor data yet"}
          </span>
        </div>
      )}

      {/* Last seen */}
      {lastSeen && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: isStale ? "var(--text-muted)" : "var(--accent-green)",
              animation: isStale ? "none" : "pulse 2s infinite",
              display: "inline-block",
            }}
          />
          {isStale ? "Last seen" : "Updated"} {lastSeen}
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function AlertsPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(
    new Set()
  );

  const fetchAlerts = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const res = await fetch("/api/alerts", { headers });
      const data = await res.json();
      if (Array.isArray(data)) setAnomalies(data);
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const [roomsRes, buildingsRes] = await Promise.all([
        fetch("/api/rooms", { headers }),
        fetch("/api/buildings", { headers }),
      ]);

      const [roomsData, buildingsData] = await Promise.all([
        roomsRes.json(),
        buildingsRes.json(),
      ]);

      if (Array.isArray(roomsData)) setRooms(roomsData);
      if (Array.isArray(buildingsData)) {
        setBuildings(buildingsData);
        // Expand all buildings by default
        setExpandedBuildings(
          new Set(buildingsData.map((b: Building) => b.building_id))
        );
      }
    } catch (err) {
      console.error("Failed to fetch rooms/buildings:", err);
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    fetchRooms();
  }, [fetchAlerts, fetchRooms]);

  // Realtime: listen for new anomalies
  useRealtime<Anomaly>(
    { table: "anomalies", event: "INSERT" },
    () => { fetchAlerts(); }
  );

  // Realtime: refresh room data on new sensor readings
  useRealtime(
    { table: "sensor_readings", event: "INSERT" },
    () => { fetchRooms(); }
  );
  useRealtime(
    { table: "readings", event: "INSERT" },
    () => { fetchRooms(); }
  );

  const handleResolve = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      await fetch(`/api/alerts/${id}/resolve`, {
        method: "PUT",
        headers,
      });

      setAnomalies((prev) => prev.filter((a) => a.anomaly_id !== id));
    } catch (err) {
      console.error("Failed to resolve alert:", err);
    }
  };

  const severityColor = (s: string) => {
    switch (s) {
      case "HIGH":
        return "red";
      case "MEDIUM":
        return "amber";
      default:
        return "blue";
    }
  };

  const toggleBuilding = (id: string) => {
    setExpandedBuildings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Group rooms by building
  const roomsByBuilding = buildings.reduce<Record<string, Room[]>>(
    (acc, b) => {
      acc[b.building_id] = rooms.filter(
        (r) => r.building_id === b.building_id
      );
      return acc;
    },
    {}
  );

  // Rooms with no matched building
  const knownBuildingIds = new Set(buildings.map((b) => b.building_id));
  const orphanRooms = rooms.filter((r) => !knownBuildingIds.has(r.building_id));

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2>Alerts &amp; Room Status</h2>
        <p>Active anomalies and live sensor readings across all rooms</p>
      </div>

      {/* ── Anomalies Table ── */}
      {anomalies.length === 0 ? (
        <div className="empty-state" style={{ paddingBottom: 24 }}>
          <div className="empty-state-icon">✅</div>
          <h3>All Clear</h3>
          <p>No active alerts. The campus is running smoothly.</p>
        </div>
      ) : (
        <div className="table-container animate-in" style={{ marginBottom: 40 }}>
          <div className="table-header">
            <h3>Active Alerts</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="live-dot" />
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  fontWeight: 500,
                }}
              >
                {anomalies.length} active
              </span>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Severity</th>
                <th>Room</th>
                <th>Message</th>
                <th>Started</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a) => (
                <tr key={a.anomaly_id}>
                  <td
                    style={{
                      color: "var(--text-primary)",
                      fontWeight: 500,
                    }}
                  >
                    {a.type === "GHOST_COOLING"
                      ? a.message.toLowerCase().includes("ac")
                        ? "AC WASTE"
                        : "LIGHT WASTE"
                      : a.type.replace(/_/g, " ")}
                  </td>
                  <td>
                    <span className={`badge ${severityColor(a.severity)}`}>
                      <span className="badge-dot" />
                      {a.severity}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      🚪 {a.rooms?.name || a.room_id || "—"}
                    </div>
                    {a.rooms?.buildings?.name && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <span>🏢 {a.rooms.buildings.name}</span>
                        {a.rooms.floors?.name && (
                          <>
                            <span style={{ fontSize: 8 }}>•</span>
                            <span>📶 {a.rooms.floors.name}</span>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                  <td>{a.message}</td>
                  <td style={{ fontSize: 12 }}>
                    {new Date(a.start_at).toLocaleString()}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleResolve(a.anomaly_id)}
                    >
                      Resolve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Building Room Status Section ── */}
      <div style={{ marginTop: 8 }}>
        {/* Section header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
            <h3
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 4,
              }}
            >
              🏢 Building Room Status
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Live sensor readings from all monitored rooms
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="live-dot" />
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
              {rooms.length} room{rooms.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {roomsLoading ? (
          <div className="loading">
            <div className="loading-spinner" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🚪</div>
            <h3>No Rooms Found</h3>
            <p>No rooms are currently registered in the system.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {buildings.map((building) => {
              const buildingRooms = roomsByBuilding[building.building_id] ?? [];
              const isExpanded = expandedBuildings.has(building.building_id);
              const occupiedCount = buildingRooms.filter(
                (r) => r.room_status?.occupancy === "OCCUPIED"
              ).length;
              const acWasteCount = buildingRooms.filter(
                (r) => r.room_status?.occupancy !== "OCCUPIED" && r.room_status?.ac_status === true
              ).length;
              const lightWasteCount = buildingRooms.filter(
                (r) => r.room_status?.occupancy !== "OCCUPIED" && r.room_status?.light_status === true
              ).length;
              const wasteCount = acWasteCount + lightWasteCount;

              return (
                <div
                  key={building.building_id}
                  style={{
                    background: "var(--bg-card)",
                    border: `1px solid ${wasteCount > 0 ? "rgba(239,68,68,0.2)" : "var(--border-color)"}`,
                    borderRadius: "var(--radius-lg)",
                    overflow: "hidden",
                    transition: "border-color 0.2s",
                  }}
                >
                  {/* Building header */}
                  <button
                    onClick={() => toggleBuilding(building.building_id)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "18px 24px",
                      background: "transparent",
                      border: "none",
                      borderBottom: isExpanded
                        ? "1px solid var(--border-color)"
                        : "none",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(0,173,181,0.04)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    {/* Icon */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "var(--radius-md)",
                        background: "rgba(0,173,181,0.12)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        flexShrink: 0,
                      }}
                    >
                      🏢
                    </div>

                    {/* Title + badges */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 16,
                          color: "var(--text-primary)",
                        }}
                      >
                        {building.name}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginTop: 4,
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--text-muted)",
                          }}
                        >
                          {buildingRooms.length} room
                          {buildingRooms.length !== 1 ? "s" : ""}
                        </span>
                        {occupiedCount > 0 && (
                          <span
                            className="badge green"
                            style={{ fontSize: 10, padding: "2px 8px" }}
                          >
                            <span className="badge-dot" />
                            {occupiedCount} occupied
                          </span>
                        )}
                        {acWasteCount > 0 && (
                          <span
                            className="badge red"
                            style={{ fontSize: 10, padding: "2px 8px" }}
                          >
                            <span className="badge-dot" />
                            {acWasteCount} AC waste
                          </span>
                        )}
                        {lightWasteCount > 0 && (
                          <span
                            className="badge amber"
                            style={{ fontSize: 10, padding: "2px 8px" }}
                          >
                            <span className="badge-dot" />
                            {lightWasteCount} light waste
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Chevron */}
                    <span
                      style={{
                        fontSize: 14,
                        color: "var(--text-muted)",
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.25s",
                        flexShrink: 0,
                      }}
                    >
                      ▼
                    </span>
                  </button>

                  {/* Rooms grid */}
                  {isExpanded && (
                    <div style={{ padding: "20px 24px" }}>
                      {buildingRooms.length === 0 ? (
                        <div
                          style={{
                            textAlign: "center",
                            padding: "24px",
                            color: "var(--text-muted)",
                            fontSize: 13,
                          }}
                        >
                          No rooms registered for this building.
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fill, minmax(240px, 1fr))",
                            gap: 16,
                          }}
                        >
                          {buildingRooms.map((room) => (
                            <RoomCard key={room.room_id} room={room} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Orphan rooms (no matched building) */}
            {orphanRooms.length > 0 && (
              <div
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-lg)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "18px 24px",
                    borderBottom: "1px solid var(--border-color)",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "var(--radius-md)",
                      background: "rgba(245,158,11,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                    }}
                  >
                    🚪
                  </div>
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 16,
                        color: "var(--text-primary)",
                      }}
                    >
                      Other Rooms
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {orphanRooms.length} room
                      {orphanRooms.length !== 1 ? "s" : ""} — building unresolved
                    </div>
                  </div>
                </div>
                <div style={{ padding: "20px 24px" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(240px, 1fr))",
                      gap: 16,
                    }}
                  >
                    {orphanRooms.map((room) => (
                      <RoomCard key={room.room_id} room={room} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
