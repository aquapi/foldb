/**
 * Check whether a match b
 * @param a 
 * @param b 
 * @returns 
 */
function match(a: any, b: any) {
    if (!a || a === b)
        return true;

    if (typeof a === "object") {
        for (const key in a) 
            if (!match(a[key], b[key]))
                return false;
        
        return true;
    } 
        
    return false;
}

export = match;