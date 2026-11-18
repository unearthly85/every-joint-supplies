import product from "./product.json"

/** Single source for the product name and fork feature flags. Edit product.json to rename the app. */
export const productName: string = product.productName
export const filePrefix: string = product.filePrefix
export const description: string = product.description
export const upstreamName: string = product.upstreamName
export const upstreamUrl: string = product.upstreamUrl
export const credit: string = product.credit
export const verse: string = product.verse
export const repositoryUrl: string = product.repository
export const releasesApi = `https://api.github.com/repos/${product.githubOwner}/${product.githubRepo}/releases`
export const releasesPage = `https://github.com/${product.githubOwner}/${product.githubRepo}/releases`

export const churchAppsCloudSync: boolean = product.features.churchAppsCloudSync === true
export const upstreamDonatePrompt: boolean = product.features.upstreamDonatePrompt === true
export const upstreamAnalytics: boolean = product.features.upstreamAnalytics === true

const upstreamNamePattern = new RegExp(product.upstreamName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")

/** Swap the upstream product name in user-visible copy. Leaves freeshow.app and other lowercase ids alone. */
export function applyBrandText(value: string): string {
    if (!value || !value.includes(product.upstreamName)) return value
    return value.replace(upstreamNamePattern, product.productName)
}

export function brandDictionary<T extends Record<string, { [key: string]: string } | undefined>>(messages: T): T {
    for (const section of Object.keys(messages)) {
        const block = messages[section]
        if (!block) continue
        for (const key of Object.keys(block)) {
            const value = block[key]
            if (typeof value === "string") block[key] = applyBrandText(value)
        }
    }
    return messages
}
