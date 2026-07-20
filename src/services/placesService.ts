let loaderPromise: Promise<typeof google> | null = null

/** Lazily injects the Maps JS bootstrap loader and resolves once `google.maps` is ready. */
function loadGoogleMaps(): Promise<typeof google> {
  if (loaderPromise) return loaderPromise
  loaderPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve(window.google)
      return
    }
    const key: string | undefined = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!key) {
      reject(new Error('Address search is not set up yet — switch to Text mode.'))
      return
    }
    const callbackName = '__s2gGoogleMapsLoaded'
    ;(window as unknown as Record<string, () => void>)[callbackName] = () => resolve(window.google)
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&loading=async&callback=${callbackName}`
    script.async = true
    script.onerror = () => reject(new Error("Couldn't load Google Maps — try again later."))
    document.head.appendChild(script)
  })
  return loaderPromise
}

export interface AddressSuggestion {
  placeId: string
  text: string
}

/** Autocomplete suggestions for a partial address as the host types. */
export async function searchAddress(query: string): Promise<AddressSuggestion[]> {
  const g = await loadGoogleMaps()
  const { AutocompleteSuggestion } = (await g.maps.importLibrary(
    'places',
  )) as google.maps.PlacesLibrary
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: query })
  return suggestions
    .filter((s) => s.placePrediction)
    .map((s) => ({
      placeId: s.placePrediction!.placeId,
      text: s.placePrediction!.text.toString(),
    }))
}

/** Resolves a selected suggestion to its full formatted address. */
export async function resolveAddress(placeId: string): Promise<string> {
  const g = await loadGoogleMaps()
  const { Place } = (await g.maps.importLibrary('places')) as google.maps.PlacesLibrary
  const place = new Place({ id: placeId })
  await place.fetchFields({ fields: ['formattedAddress'] })
  return place.formattedAddress ?? ''
}
