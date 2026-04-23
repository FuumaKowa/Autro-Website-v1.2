const supabaseUrl = "https://yygbmcvgdvsepdiwsixz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5Z2JtY3ZnZHZzZXBkaXdzaXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDAyNTgsImV4cCI6MjA5MjQxNjI1OH0.bN3o0WixWBlfZ2-WpfeK1A5zPCUhrcvLot4rxsdoGEc";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

async function signInUser(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
}

async function signOutUser() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

async function getCurrentUser() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) throw error;
  return data.user;
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "admin-login.html";
    return null;
  }

  const { data, error } = await supabaseClient
    .from("admins")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    window.location.href = "admin-login.html";
    return null;
  }

  return { user, admin: data };
}

async function requireAgent() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "agent-login.html";
    return null;
  }

  const { data, error } = await supabaseClient
    .from("agents")
    .select("*")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    window.location.href = "agent-login.html";
    return null;
  }

  return { user, agent: data };
}