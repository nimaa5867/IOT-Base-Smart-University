import { supabase } from "@/lib/supabase";

export async function getActiveAnomalies() {
  // Try detailed relation join first
  const { data, error } = await supabase
    .from("anomalies")
    .select("*, rooms(name, code, buildings(name), floors(name, level))")
    .eq("is_active", true)
    .order("start_at", { ascending: false });

  if (error) {
    console.warn("Detailed relations join failed, falling back to basic room join:", error.message);
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("anomalies")
      .select("*, rooms(name, code)")
      .eq("is_active", true)
      .order("start_at", { ascending: false });

    if (fallbackError) throw fallbackError;
    return fallbackData;
  }

  return data;
}

export async function getAllAnomalies(limit = 100) {
  const { data, error } = await supabase
    .from("anomalies")
    .select("*, rooms(name, code, buildings(name), floors(name, level))")
    .order("start_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("Detailed relations join failed, falling back to basic room join:", error.message);
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("anomalies")
      .select("*, rooms(name, code)")
      .order("start_at", { ascending: false })
      .limit(limit);

    if (fallbackError) throw fallbackError;
    return fallbackData;
  }

  return data;
}

export async function createAnomaly(input: {
  type: string;
  room_id?: string;
  node_id?: string;
  severity: string;
  message: string;
}) {
  const { data, error } = await supabase
    .from("anomalies")
    .insert({
      ...input,
      start_at: new Date().toISOString(),
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function resolveAnomaly(anomaly_id: string) {
  const { data, error } = await supabase
    .from("anomalies")
    .update({
      is_active: false,
      end_at: new Date().toISOString(),
    })
    .eq("anomaly_id", anomaly_id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
