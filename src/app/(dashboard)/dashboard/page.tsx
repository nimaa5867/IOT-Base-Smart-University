"use client";

import { useEffect, useState, useCallback } from "react";
import StatCard from "@/components/StatCard";
import { useRealtime } from "@/hooks/useRealtime";

interface DashboardStats {
  buildings: number;
  rooms: number;
  occupiedRooms: number;
  sensors: number;
  activeAlerts: number;
}

interface Reading {
  reading_id: string;
  node_id: string;
  room_id: string;
  temperature_c: number | null;
  noise_db: number | null;
  light_lux: number | null;
  occupancy_detected: boolean | null;
  created_at: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    buildings: 0,
    rooms: 0,
    occupiedRooms: 0,
    sensors: 0,
    activeAlerts: 0,
  });
  const [occupiedRoomsList, setOccupiedRoomsList] = useState<any[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [allRooms, setAllRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Welcome back");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserName(user.name || user.email?.split("@")[0] || "");
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const [buildingsRes, roomsRes, sensorsRes, alertsRes, readingsRes] =
        await Promise.all([
          fetch("/api/buildings", { headers }),
          fetch("/api/rooms", { headers }),
          fetch("/api/sensors", { headers }),
          fetch("/api/alerts", { headers }),
          fetch("/api/readings?limit=100", { headers }),
        ]);

      const [buildings, rooms, sensors, alerts, recentReadings] =
        await Promise.all([
          buildingsRes.json(),
          roomsRes.json(),
          sensorsRes.json(),
          alertsRes.json(),
          readingsRes.json(),
        ]);

      let occupiedCount = 0;
      let occupiedList: any[] = [];
      if (Array.isArray(rooms)) {
        setAllRooms(rooms);
        occupiedList = rooms.filter((r: { room_status?: { occupancy?: string } }) => {
          const status = r.room_status;
          return status?.occupancy === "OCCUPIED";
        });
        occupiedCount = occupiedList.length;
      }
      
      setOccupiedRoomsList(occupiedList);

      setStats({
        buildings: Array.isArray(buildings) ? buildings.length : 0,
        rooms: Array.isArray(rooms) ? rooms.length : 0,
        occupiedRooms: occupiedCount,
        sensors: Array.isArray(sensors) ? sensors.length : 0,
        activeAlerts: Array.isArray(alerts) ? alerts.length : 0,
      });

      if (Array.isArray(recentReadings)) {
        setReadings(recentReadings);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Realtime: subscribe to new readings
  useRealtime(
    { table: "readings", event: "INSERT" },
    () => {
      fetchDashboardData();
    }
  );

  // Realtime: subscribe to ESP32 sensor_readings
  useRealtime(
    { table: "sensor_readings", event: "INSERT" },
    () => {
      fetchDashboardData();
    }
  );

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  const occupancyRate = stats.rooms > 0 ? Math.round((stats.occupiedRooms / stats.rooms) * 100) : 0;

  return (
    <div>
      {/* Welcome Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2>{greeting}{userName ? `, ${userName}` : ""} 👋</h2>
          <p>Here&apos;s what&apos;s happening across your smart campus today</p>
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 14px",
          background: "rgba(0, 173, 181, 0.08)",
          borderRadius: 20,
          border: "1px solid rgba(0, 173, 181, 0.12)",
          fontSize: 13,
          color: "var(--accent-blue)",
          fontWeight: 600,
        }}>
          <span className="live-dot" />
          {occupancyRate}% Campus Utilization
        </div>
      </div>

      <div className="card-grid" style={{ marginBottom: 24 }}>
        <StatCard
          icon="🏢"
          label="Total Buildings"
          value={stats.buildings}
          sub="Registered buildings"
          color="blue"
        />
        <StatCard
          icon="🚪"
          label="Total Rooms"
          value={stats.rooms}
          sub="Monitored rooms"
          color="green"
        />
        <StatCard
          icon="👥"
          label="Occupied Rooms"
          value={stats.occupiedRooms}
          sub="Currently in use"
          color="purple"
        />
        <StatCard
          icon="📡"
          label="Active Sensors"
          value={stats.sensors}
          sub="Connected nodes"
          color="amber"
        />
        <StatCard
          icon="🔔"
          label="Active Alerts"
          value={stats.activeAlerts}
          sub="Require attention"
          color="red"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div className="table-container animate-in">
          <div className="table-header">
            <h3>Occupied Rooms</h3>
            <span className="badge green" style={{ fontSize: 11, padding: "3px 8px" }}>
              {occupiedRoomsList.length} active
            </span>
          </div>
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            <table>
              <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                <tr>
                  <th>Room Name</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Temp</th>
                </tr>
              </thead>
              <tbody>
                {occupiedRoomsList.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                      No rooms are currently occupied
                    </td>
                  </tr>
                ) : (
                  occupiedRoomsList.map((r) => {
                    const status = r.room_status;
                    return (
                      <tr key={r.room_id}>
                        <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                          {r.name || "—"}
                        </td>
                        <td>{r.code || "—"}</td>
                        <td>
                          <span className={`badge ${r.type === "LAB" ? "blue" : r.type === "HALL" ? "purple" : "amber"}`}>
                            {r.type || "—"}
                          </span>
                        </td>
                        <td>{status?.temperature_c != null ? `${status.temperature_c}°C` : "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Stats Panel */}
        <div className="card animate-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>System Overview</h3>

          {/* Occupancy Bar */}
          <div style={{ padding: "16px 0", borderBottom: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Room Occupancy</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-blue)" }}>{occupancyRate}%</span>
            </div>
            <div style={{ height: 6, background: "var(--bg-surface)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                width: `${occupancyRate}%`,
                height: "100%",
                background: "linear-gradient(90deg, #00ADB5, #00d4a1)",
                borderRadius: 3,
                transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: "0 0 8px rgba(0, 173, 181, 0.4)",
              }} />
            </div>
          </div>

          {/* Quick Info Items */}
          {[
            { label: "Active Alerts", value: stats.activeAlerts, color: stats.activeAlerts > 0 ? "var(--accent-red)" : "var(--accent-green)", icon: stats.activeAlerts > 0 ? "⚠️" : "✅" },
            { label: "Sensor Coverage", value: stats.sensors > 0 ? `${stats.sensors} nodes` : "None", color: "var(--accent-amber)", icon: "📡" },
            { label: "Buildings Monitored", value: stats.buildings, color: "var(--accent-blue)", icon: "🏢" },
          ].map((item) => (
            <div key={item.label} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 0",
              borderBottom: "1px solid var(--border-color)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{item.label}</span>
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: item.color }}>{item.value}</span>
            </div>
          ))}

          {/* Timestamp */}
          <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
            <span className="live-dot" style={{ width: 6, height: 6 }} />
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="table-container animate-in">
        <div className="table-header">
          <h3>Recent Readings</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="live-dot" />
            <span
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                fontWeight: 500,
              }}
            >
              Live
            </span>
          </div>
        </div>
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          <table>
            <thead style={{ position: "sticky", top: 0, background: "var(--bg-secondary)", zIndex: 1 }}>
              <tr>
              <th>Room</th>
              <th>Temp °C</th>
              <th>Noise dB</th>
              <th>Light lux</th>
              <th>Occupancy</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {readings.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                  No readings yet. Insert sensor data to see live updates.
                </td>
              </tr>
            ) : (
              readings.map((r) => {
                const room = allRooms.find(rm => rm.room_id === r.room_id);
                const roomDisplay = room ? (room.name || room.code || r.node_id) : r.node_id;

                return (
                  <tr key={r.reading_id}>
                    <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                      {roomDisplay}
                    </td>
                    <td>{r.temperature_c ?? "—"}</td>
                  <td>{r.noise_db ?? "—"}</td>
                  <td>{r.light_lux ?? "—"}</td>
                  <td>
                    <span
                      className={`badge ${r.occupancy_detected ? "green" : "red"}`}
                    >
                      <span className="badge-dot" />
                      {r.occupancy_detected ? "Yes" : "No"}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {new Date(r.created_at).toLocaleTimeString()}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Responsive override for 2-col grid */}
      <style>{`
        @media (max-width: 900px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
