import type { Database } from "@/lib/supabase";

type Driver = Database["public"]["Tables"]["drivers"]["Row"];
type DriverInsert = Database["public"]["Tables"]["drivers"]["Insert"];
type DriverUpdate = Database["public"]["Tables"]["drivers"]["Update"];

export class DriverService {
  static async getAllDrivers(): Promise<Driver[]> {
    try {
      const response = await fetch('/api/drivers', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `Failed to fetch drivers`)
      }
      const data = await response.json()
      return data || []
    } catch (error) {
      console.error('Error fetching drivers:', error)
      throw error
    }
  }

  static async getDriverById(id: number): Promise<Driver | null> {
    try {
      const response = await fetch(`/api/drivers/${id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      if (response.status === 404) return null
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `Failed to fetch driver ${id}`)
      }
      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching driver:', error)
      throw error
    }
  }

  static async getActiveDrivers(): Promise<Driver[]> {
    const all = await this.getAllDrivers()
    return (all || []).filter((d) => d.status === 'active')
  }

  static async createDriver(driver: DriverInsert): Promise<Driver> {
    try {
      const response = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(driver),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create driver')
      }
      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error creating driver:', error)
      throw error
    }
  }

  static async updateDriver(
    id: number,
    updates: DriverUpdate
  ): Promise<Driver> {
    try {
      const response = await fetch(`/api/drivers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `Failed to update driver ${id}`)
      }
      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error updating driver:', error)
      throw error
    }
  }

  static async updateDriverStatus(
    id: number,
    status: "active" | "inactive" | "on_break"
  ): Promise<Driver> {
    return this.updateDriver(id, { status });
  }

  static async deleteDriver(id: number): Promise<void> {
    try {
      const response = await fetch(`/api/drivers/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `Failed to delete driver ${id}`)
      }
      return
    } catch (error) {
      console.error('Error deleting driver:', error)
      throw error
    }
  }

  static async getDriverStats() {
    const drivers = await this.getAllDrivers()
    const stats = {
      total: drivers.length,
      active: drivers.filter((d) => d.status === 'active').length,
      inactive: drivers.filter((d) => d.status === 'inactive').length,
      on_break: drivers.filter((d) => d.status === 'on_break').length,
    }
    return stats
  }
}
