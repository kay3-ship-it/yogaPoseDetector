import CONFIG from "../config";
import { isSlotOnline } from "./sensorStatus";

export const COLLECTION_TYPES = {
  A: {
    id: "A_VideoOnly",
    label: "A_VideoOnly",
    description: "Video + Landmarks only",
  },
  B: {
    id: "B_Video_IMU",
    label: "B_Video_IMU",
    description: "Video + Landmarks + Available Body IMUs",
  },
  C: {
    id: "C_Video_IMU_Footrest",
    label: "C_Video_IMU_Footrest",
    description: "Video + Landmarks + Available Body & Footrest IMUs",
  },
};

const BODY_IDS = CONFIG.SENSOR_SLOTS.filter((s) => s.status === "active").map((s) => s.id);
const FOOTREST_IDS = CONFIG.SENSOR_SLOTS.filter((s) => s.status === "placeholder").map(
  (s) => s.id
);

export function getConnectedSensorIds(imuDevices) {
  return CONFIG.SENSOR_SLOTS.filter((slot) => isSlotOnline(slot, imuDevices)).map(
    (slot) => slot.id
  );
}

export function getBodyConnectionState(imuDevices) {
  const bodyOnline = BODY_IDS.filter((id) => imuDevices[id]?.online === true);
  return {
    allConnected: bodyOnline.length === BODY_IDS.length,
    anyConnected: bodyOnline.length > 0,
    connectedIds: bodyOnline,
    requiredCount: BODY_IDS.length,
  };
}

export function getFootrestConnectionState(imuDevices) {
  const footrestOnline = FOOTREST_IDS.filter((id) => imuDevices[id]?.online === true);
  return {
    allConnected: footrestOnline.length === FOOTREST_IDS.length,
    anyConnected: footrestOnline.length > 0,
    connectedIds: footrestOnline,
    requiredCount: FOOTREST_IDS.length,
  };
}

export function getCollectionTypeAvailability(imuDevices) {
  const body = getBodyConnectionState(imuDevices);
  const footrest = getFootrestConnectionState(imuDevices);

  const aEnabled = true;
  const bEnabled = body.anyConnected;
  const cEnabled = body.anyConnected && footrest.anyConnected;

  return {
    A: {
      enabled: aEnabled,
      disabledReason: null,
    },
    B: {
      enabled: bEnabled,
      disabledReason: bEnabled
        ? null
        : "No body IMU sensors connected",
    },
    C: {
      enabled: cEnabled,
      disabledReason: !body.anyConnected
        ? "No body IMU sensors connected"
        : !footrest.anyConnected
          ? "No footrest IMU sensors connected"
          : null,
    },
  };
}

export function getDefaultCollectionType(imuDevices) {
  const availability = getCollectionTypeAvailability(imuDevices);
  if (availability.C.enabled) return COLLECTION_TYPES.C.id;
  if (availability.B.enabled) return COLLECTION_TYPES.B.id;
  return COLLECTION_TYPES.A.id;
}

function normalizeSensorId(id) {
  return String(id || "").trim().toLowerCase();
}

export function collectSensorIdsFromRecordings(sessionRecordings = []) {
  const ids = new Set();
  for (const recording of sessionRecordings) {
    if (recording?.skipped) continue;
    for (const packet of recording.imuPackets || []) {
      for (const sensorId of Object.keys(packet?.devices || {})) {
        const normalized = normalizeSensorId(sensorId);
        if (normalized) ids.add(normalized);
      }
    }
  }
  return [...ids];
}

/**
 * Infer A/B/C from sensor IDs that actually contributed data during collection.
 * A = video only, B = video + body IMU, C = video + body + footrest IMU.
 */
export function inferCollectionTypeFromSensorIds(sensorIds = []) {
  const normalized = new Set(sensorIds.map(normalizeSensorId).filter(Boolean));
  const bodyPresent = BODY_IDS.some((id) => normalized.has(id));
  const footrestPresent = FOOTREST_IDS.some((id) => normalized.has(id));

  if (bodyPresent && footrestPresent) return COLLECTION_TYPES.C.id;
  if (bodyPresent) return COLLECTION_TYPES.B.id;
  return COLLECTION_TYPES.A.id;
}

function collectionTypeKeyFromId(typeId) {
  if (typeId === COLLECTION_TYPES.B.id) return "B";
  if (typeId === COLLECTION_TYPES.C.id) return "C";
  return "A";
}

function disabledReasonForCollectedMismatch(detectedKey, optionKey) {
  if (detectedKey === optionKey) return null;
  const labels = {
    A: "video only",
    B: "video + body IMU",
    C: "video + body & footrest IMU",
  };
  return `Session data is ${labels[detectedKey]} — this option does not apply`;
}

/**
 * After collection, only the dataset type matching recorded data stays selectable.
 */
export function getCollectionTypeAvailabilityFromCollectedData(sensorIds = []) {
  const detectedId = inferCollectionTypeFromSensorIds(sensorIds);
  const detectedKey = collectionTypeKeyFromId(detectedId);

  return {
    detectedId,
    detectedKey,
    A: {
      enabled: detectedKey === "A",
      disabledReason: disabledReasonForCollectedMismatch(detectedKey, "A"),
    },
    B: {
      enabled: detectedKey === "B",
      disabledReason: disabledReasonForCollectedMismatch(detectedKey, "B"),
    },
    C: {
      enabled: detectedKey === "C",
      disabledReason: disabledReasonForCollectedMismatch(detectedKey, "C"),
    },
  };
}

export const STORAGE_LOCATIONS = {
  D: { id: "D", label: "D:\\ Local Drive", root: "D:\\YogaDataset" },
  E: { id: "E", label: "E:\\ External Hard Disk", root: "E:\\YogaDataset" },
};
