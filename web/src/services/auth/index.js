import { supabase } from "../../lib/supabase.js";
import { createAuthService } from "./authService.js";

export const authService = createAuthService(supabase);
