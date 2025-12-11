/**
 * Parsuje odpowiedź wagi zgodnie z protokołem RINCMD (Rinstrum C320).
 */
export function parseRinCmdResponse(data: string): { weight: string; status: "Gross" | "Net" } | null {
  let match = data.match(/(\d{8})([+-])(\d+\.\d+)(kg|lb)/i);
  
  if (match) {
    const [_, commandCode, sign, value, unit] = match;
    const weight = `${sign}${parseFloat(value).toFixed(2)} ${unit.toLowerCase()}`;
    
    const status = commandCode === "20050026" ? "Gross" : "Net";
    
    return { weight, status };
  }
  
  match = data.match(/:\s*([+-]?)\s*(\d+\.?\d*)\s*(kg|lb|g)\s*([GNTZ])/i);
  
  if (match) {
      const [_, sign, value, unit, statusChar] = match;
      
      const numericValue = parseFloat(value);
      const formattedValue = numericValue.toFixed(numericValue % 1 !== 0 ? 2 : 0);
      
      const weight = `${sign.trim()}${formattedValue} ${unit.toLowerCase()}`;
      
      let status: "Gross" | "Net" = "Gross";
      if (statusChar.toUpperCase() === 'N') {
          status = "Net";
      }
      
      return { weight, status };
  }
  
  return null;
}

/**
 * Parsuje ogólną odpowiedź wagi (np. Dini Argeo DFW).
 */
export function parseGenericResponse(data: string): { weight: string; status: "Gross" | "Net" } | null {
    const match = data.match(/([+-]?\s*\d+\.\d+)\s*(kg|lb|g)/i);
    
    if (match) {
        return { weight: match[0].trim(), status: 'Gross' };
    }
    return null;
}