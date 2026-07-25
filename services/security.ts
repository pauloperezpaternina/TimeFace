export const generateTimeBasedPIN = (collaboratorId: string): string => {
  // 20 minutes in milliseconds
  const window20Min = Math.floor(Date.now() / (1000 * 60 * 20));
  const str = `${collaboratorId}-${window20Min}`;
  
  // Simple hash function (djb2)
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
  }
  
  // Ensure it's a positive number and pad to 4 digits
  const pin = Math.abs(hash % 10000).toString().padStart(4, '0');
  return pin;
};
