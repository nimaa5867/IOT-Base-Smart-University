import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────
const SOUND_THRESHOLD_DB = 60;       // Rule 1: noise must exceed 60 dB
const LIGHT_LDR_THRESHOLD = 2000;    // Rule 2: LDR analog < 2000 → lights ON
const AC_TEMP_THRESHOLD   = 26.0;    // Rule 3: temp < 26°C → AC is ON

// ─── Helper: fire an anomaly only if none of the same type is already active ──
async function maybeCreateAlert(params: {
  type: string;
  severity: string;
  message: string;
  room_id: string;
}) {
  try {
    // Query all active anomalies for the room
    const { data: existing, error: searchError } = await supabase
      .from("anomalies")
      .select("anomaly_id, message")
      .eq("type", "GHOST_COOLING")
      .eq("room_id", params.room_id)
      .eq("is_active", true);

    if (searchError) {
      console.error("Error searching active anomalies:", searchError);
    }

    // Deduplicate based on type keyword in message (AC vs Light)
    const isAc = params.message.toLowerCase().includes("ac");
    const isDuplicate = existing?.some((a) => {
      const existingIsAc = a.message.toLowerCase().includes("ac");
      return existingIsAc === isAc;
    });

    if (isDuplicate) return; // already active, skip

    const { error: insertError } = await supabase.from("anomalies").insert({
      type:      "GHOST_COOLING",
      severity:  params.severity,
      message:   params.message,
      room_id:   params.room_id,
      start_at:  new Date().toISOString(),
      is_active: true,
    });

    if (insertError) {
      console.error(`Error inserting anomaly for room ${params.room_id}:`, insertError);
    }
  } catch (err) {
    console.error("Error in maybeCreateAlert:", err);
  }
}

// ─── Helper: auto-resolve an alert when the condition clears ──────────────────
async function maybeResolveAlert(room_id: string, keyword: string) {
  try {
    const { data: existing, error: searchError } = await supabase
      .from("anomalies")
      .select("anomaly_id, message")
      .eq("type", "GHOST_COOLING")
      .eq("room_id", room_id)
      .eq("is_active", true);

    if (searchError) {
      console.error("Error searching anomalies to resolve:", searchError);
    }

    const targets = existing?.filter((a) =>
      a.message.toLowerCase().includes(keyword)
    ) || [];

    for (const t of targets) {
      const { error: updateError } = await supabase
        .from("anomalies")
        .update({ is_active: false, end_at: new Date().toISOString() })
        .eq("anomaly_id", t.anomaly_id);

      if (updateError) {
        console.error(`Error resolving anomaly for room ${room_id}:`, updateError);
      }
    }
  } catch (err) {
    console.error("Error in maybeResolveAlert:", err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      room_id,
      temp,
      humidity,
      noise_level,
      is_occupied: directOccupied,
      light_status: directLightStatus,
      ac_status: directAcStatus,
      pir_detected,
      ldr_value,
    } = body;

    if (!room_id) {
      return NextResponse.json(
        { error: "room_id is required from the ESP32" },
        { status: 400 }
      );
    }

    // ── Rule 2: Light Status ──────────────────────────────────────────────────
    // Direct boolean if passed, otherwise compute from LDR analog value (< 2000 is ON)
    const light_status: boolean =
      directLightStatus !== undefined
        ? Boolean(directLightStatus)
        : ldr_value != null
        ? Number(ldr_value) < LIGHT_LDR_THRESHOLD
        : false;

    // ── Rule 3: AC Status ─────────────────────────────────────────────────────
    // Direct boolean if passed, otherwise compute from DHT11 temp (< 26°C is ON)
    const ac_status: boolean =
      directAcStatus !== undefined
        ? Boolean(directAcStatus)
        : temp != null
        ? Number(temp) < AC_TEMP_THRESHOLD
        : false;

    // ── Rule 1: Room Occupancy ────────────────────────────────────────────────
    // Direct boolean if passed, otherwise compute from PIR motion + Sound > 60 dB
    const is_occupied: boolean =
      directOccupied !== undefined
        ? Boolean(directOccupied)
        : pir_detected === true && Number(noise_level) > SOUND_THRESHOLD_DB;

    // ── Insert into sensor_readings ───────────────────────────────────────────
    // Only insert columns that exist on the sensor_readings table:
    // (id, room_id, created_at, temp, humidity, noise_level, is_occupied, light_status, ac_status)
    const readingPayload: Record<string, unknown> = {
      room_id,
      temp: temp != null ? Number(temp) : null,
      humidity: humidity != null ? Number(humidity) : null,
      noise_level: noise_level != null ? Number(noise_level) : null,
      is_occupied,
      light_status,
      ac_status,
    };

    let { data, error } = await supabase
      .from("sensor_readings")
      .insert([readingPayload])
      .select()
      .single();

    // Fallback: If ac_status column is absent in some schema version, retry without it
    if (error && error.message?.includes("ac_status")) {
      delete readingPayload.ac_status;
      const retry = await supabase
        .from("sensor_readings")
        .insert([readingPayload])
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error("Supabase insert error (sensor_readings):", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ── Upsert room_status snapshot ───────────────────────────────────────────
    const occupancy = is_occupied ? "OCCUPIED" : "EMPTY";
    const ghostCooling = !is_occupied && (light_status || ac_status);

    const { error: statusError } = await supabase.from("room_status").upsert(
      {
        room_id,
        occupancy,
        temperature_c: temp != null ? Number(temp) : null,
        noise_db: noise_level != null ? Number(noise_level) : null,
        light_lux: light_status ? 500 : 0,
        ghost_cooling_active: ghostCooling,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_id" }
    );

    if (statusError) {
      console.error("room_status upsert warning:", statusError);
    }

    // ── Rule 4: AC Waste Alert ────────────────────────────────────────────────
    // Room vacant AND AC on (temp < 26°C or ac_status is true) → alert
    if (!is_occupied && ac_status) {
      await maybeCreateAlert({
        type:     "GHOST_COOLING",
        severity: "HIGH",
        message:  `AC Waste: Room is vacant but AC appears ON (temp ${temp != null ? Number(temp).toFixed(1) : "—"}°C < 26°C). Turn off AC to save energy.`,
        room_id,
      });
    } else {
      // Conditions cleared → auto-resolve existing AC_WASTE alert
      await maybeResolveAlert(room_id, "ac");
    }

    // ── Rule 5: Light Waste Alert ─────────────────────────────────────────────
    // Room vacant AND lights on → alert
    if (!is_occupied && light_status) {
      await maybeCreateAlert({
        type:     "GHOST_COOLING",
        severity: "MEDIUM",
        message:  `Light Waste: Room is vacant but lights appear ON. Turn off lights to save energy.`,
        room_id,
      });
    } else {
      // Conditions cleared → auto-resolve existing LIGHT_WASTE alert
      await maybeResolveAlert(room_id, "light");
    }

    return NextResponse.json({
      success: true,
      data,
      computed: { is_occupied, light_status, ac_status, occupancy },
    }, { status: 201 });

  } catch (err: unknown) {
    console.error("Error processing sensor reading:", err);
    const msg = err instanceof Error ? err.message : "Invalid sensor data payload";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
