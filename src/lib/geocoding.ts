// Reverse geocoding using Nominatim (OpenStreetMap)
export interface GeocodingResult {
  address: string;
  display_name: string;
  road?: string;
  house_number?: string;
  suburb?: string;
  city?: string;
  state?: string;
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<GeocodingResult | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
      {
        headers: {
          "Accept-Language": "pt-BR",
          "User-Agent": "PontoEletronico/1.0",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch address");
    }

    const data = await response.json();

    const road = data.address?.road || data.address?.pedestrian || data.address?.street || "";
    const houseNumber = data.address?.house_number || "";
    const suburb = data.address?.suburb || data.address?.neighbourhood || "";
    const city = data.address?.city || data.address?.town || data.address?.municipality || "";
    const state = data.address?.state || "";

    // Build a formatted address
    let address = "";
    
    if (road) {
      address = road;
      if (houseNumber) {
        address += `, ${houseNumber}`;
      } else {
        address += " (próximo)";
      }
    }
    
    if (suburb && !address.includes(suburb)) {
      address += address ? ` - ${suburb}` : suburb;
    }
    
    if (city && !address.includes(city)) {
      address += address ? `, ${city}` : city;
    }
    
    if (state && !address.includes(state)) {
      address += address ? ` - ${state}` : state;
    }

    return {
      address: address || data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      display_name: data.display_name,
      road,
      house_number: houseNumber,
      suburb,
      city,
      state,
    };
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return null;
  }
}
