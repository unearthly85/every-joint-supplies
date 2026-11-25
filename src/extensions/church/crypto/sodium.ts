import * as ns from "libsodium-wrappers-sumo"

type Sodium = typeof ns

// The package has no typed default export, and its named ESM exports stay
// undefined after ready; only the default object is filled. So keep the
// default object and hand it out through getSodium().
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Sodium is the alias we hand out
const lib = ((ns as unknown as { default?: Sodium }).default ?? ns) as Sodium

/**
 * Resolve the libsodium-wrappers-sumo library once it has finished loading.
 * Every other crypto file gets libsodium only through this function.
 */
export async function getSodium(): Promise<Sodium> {
    await lib.ready
    return lib
}

export type { Sodium }
