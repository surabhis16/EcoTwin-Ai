type MapEvent =
    | { type: "FLY_TO_WARD"; wardId: number; lon: number; lat: number }
    | { type: "HIGHLIGHT_WARD"; wardId: number; lst: number }
    | { type: "SHOW_SIMULATION"; simulationData: any }
    | { type: "SHOW_MULTI_SIMULATION"; simulations: any[] }
    | { type: "WARD_CLICKED"; wardId: number; wardName: string; lst: number; ndvi: number }

type Listener = (event: MapEvent) => void

class MapEventBus {
    private listeners: Listener[] = []

    emit(event: MapEvent) {
        this.listeners.forEach(l => l(event))
    }

    subscribe(listener: Listener) {
        this.listeners.push(listener)
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener)
        }
    }
}

export const mapBus = new MapEventBus()