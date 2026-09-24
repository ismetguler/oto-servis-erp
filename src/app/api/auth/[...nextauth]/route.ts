import { handlers } from "@/lib/auth"

// Auth.js'in kendi uc noktalari (oturum acma/kapama, CSRF token uretimi).
export const { GET, POST } = handlers
