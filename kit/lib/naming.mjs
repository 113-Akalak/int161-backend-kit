// Name conversions shared by the generator and selftest

export function singular(word) {
    if (/ies$/i.test(word)) return word.slice(0, -3) + 'y'
    if (/(ss|us|is)$/i.test(word)) return word
    if (/(ses|xes|zes|ches|shes)$/i.test(word)) return word.slice(0, -2)
    if (/s$/i.test(word)) return word.slice(0, -1)
    return word
}

export function plural(word) {
    if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies'
    if (/(s|x|z|ch|sh)$/i.test(word)) return word + 'es'
    return word + 's'
}

export function isPlural(word) {
    return singular(word) !== word
}

// brand_id -> brandId, customerNumber stays customerNumber
export function camel(name) {
    return name.replace(/[_-]+([a-zA-Z0-9])/g, (_, c) => c.toUpperCase())
}

// brandId -> brand_id
export function snake(name) {
    return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/-/g, '_').toLowerCase()
}

// order_items -> order-items, productLines -> product-lines
export function kebab(name) {
    return snake(name).replace(/_/g, '-')
}

export function pascal(name) {
    const c = camel(name)
    return c.charAt(0).toUpperCase() + c.slice(1)
}

// PRODUCT_NOT_FOUND
export function constant(name) {
    return snake(name).toUpperCase()
}
