import { ref, onMounted } from 'vue';

export function useAuth() {
  const isAuthenticated = ref(false);
  const SECRET_KEY = import.meta.env.VITE_ACCESS_KEY;

  onMounted(() => {
    if (!SECRET_KEY) {
      console.error("Error: VITE_ACCESS_KEY not set in .env.local");
      isAuthenticated.value = false;
      return;
    }

    if (sessionStorage.getItem('app_access_key') === SECRET_KEY) {
      isAuthenticated.value = true;
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      if (token === SECRET_KEY) {
        isAuthenticated.value = true;
        sessionStorage.setItem('app_access_key', SECRET_KEY);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  });

  return { isAuthenticated };
}
