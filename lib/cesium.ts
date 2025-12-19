import { Ion } from "cesium"

// cesium base url for assets
if (typeof window !== "undefined") {
    (window as any).CESIUM_BASE_URL = "/cesium"
}

// set Ion token
const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN
if (token) {
    Ion.defaultAccessToken = token
} else {
    console.warn("Cesium access token not found in environment")
}

export default Ion