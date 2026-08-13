// MAVIC Projetos — Autenticação do Painel Administrativo
// Login Controller

let sb = null;

// Inicializa Supabase
function initLoginSupabase() {
  if (typeof window.supabase !== 'undefined' && typeof SB_URL !== 'undefined' && typeof SB_KEY !== 'undefined') {
    try {
      sb = window.supabase.createClient(SB_URL, SB_KEY);
      return true;
    } catch (e) {
      console.warn('Erro ao inicializar Supabase no login:', e);
    }
  }
  return false;
}

// Verifica se já está autenticado
async function checkAlreadyLoggedIn() {
  const sessionStr = localStorage.getItem('mavic_admin_session') || sessionStorage.getItem('mavic_admin_session');
  if (sessionStr) {
    try {
      const session = JSON.parse(sessionStr);
      if (session && session.expiresAt && session.expiresAt > Date.now()) {
        const urlParams = new URLSearchParams(window.location.search);
        let redirect = urlParams.get('redirect') || 'index.html';
        // Evita loop se o redirect for a própria página de login
        if (redirect.includes('login.html')) redirect = 'index.html';
        window.location.replace(redirect);
        return true;
      }
    } catch (e) {
      localStorage.removeItem('mavic_admin_session');
      sessionStorage.removeItem('mavic_admin_session');
    }
  }
  return false;
}

// Toggle de Visibilidade de Senha
function togglePassVisibility() {
  const passInp = document.getElementById('loginPass');
  const icon = document.getElementById('passToggleIcon');
  if (!passInp) return;

  if (passInp.type === 'password') {
    passInp.type = 'text';
    if (icon) {
      icon.className = 'bi bi-eye-slash';
    }
  } else {
    passInp.type = 'password';
    if (icon) {
      icon.className = 'bi bi-eye';
    }
  }
}

// Alternar Tema na tela de login
function toggleLoginTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('mavic_theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.className = theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
  }
}

// Detecção de Caps Lock
function setupCapsLockDetector() {
  const passInp = document.getElementById('loginPass');
  const capsWarning = document.getElementById('capsWarning');
  if (!passInp || !capsWarning) return;

  const checkCaps = (e) => {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
      capsWarning.style.display = 'flex';
    } else {
      capsWarning.style.display = 'none';
    }
  };

  passInp.addEventListener('keyup', checkCaps);
  passInp.addEventListener('keydown', checkCaps);
  passInp.addEventListener('blur', () => {
    capsWarning.style.display = 'none';
  });
}

// Modal Esqueceu a Senha
function openForgotModal() {
  const el = document.getElementById('forgotOverlay');
  if (el) el.classList.add('open');
}

function closeForgotModal() {
  const el = document.getElementById('forgotOverlay');
  if (el) el.classList.remove('open');
}

// Mostra erro com animação de shake
function showLoginError(msg) {
  const alertEl = document.getElementById('loginAlert');
  const msgEl = document.getElementById('loginAlertMsg');
  const card = document.getElementById('loginCard');

  if (msgEl) msgEl.textContent = msg || 'Credenciais inválidas. Verifique seu e-mail e senha.';
  if (alertEl) {
    alertEl.className = 'login-alert error';
    alertEl.style.display = 'flex';
  }

  if (card) {
    card.classList.remove('shake');
    // Força reflow para reiniciar animação
    void card.offsetWidth;
    card.classList.add('shake');
  }
}

// Mostra sucesso
function showLoginSuccess(msg) {
  const alertEl = document.getElementById('loginAlert');
  const msgEl = document.getElementById('loginAlertMsg');
  if (msgEl) msgEl.textContent = msg || 'Login realizado com sucesso! Redirecionando…';
  if (alertEl) {
    alertEl.className = 'login-alert success';
    alertEl.style.display = 'flex';
  }
}

// Manipula o envio do formulário de login
async function handleLogin(e) {
  e.preventDefault();

  const emailInp = document.getElementById('loginEmail');
  const passInp = document.getElementById('loginPass');
  const rememberInp = document.getElementById('loginRemember');
  const btn = document.getElementById('loginBtn');
  const btnText = document.getElementById('btnText');
  const btnSpin = document.getElementById('btnSpin');

  const email = emailInp.value.trim().toLowerCase();
  const password = passInp.value;
  const remember = rememberInp ? rememberInp.checked : true;

  if (!email || !password) {
    showLoginError('Por favor, informe o e-mail e a senha.');
    return;
  }

  // Estado de loading
  btn.disabled = true;
  if (btnText) btnText.style.display = 'none';
  if (btnSpin) btnSpin.style.display = 'inline-flex';

  // Esconde alerta anterior
  const alertEl = document.getElementById('loginAlert');
  if (alertEl) alertEl.style.display = 'none';

  try {
    initLoginSupabase();

    if (!sb) {
      throw new Error('Falha ao conectar com o serviço de autenticação.');
    }

    // 1. Tenta autenticação nativa do Supabase
    const { data, error } = await sb.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      console.warn('Supabase Auth error:', error.message);
      
      let userFriendlyMsg = 'E-mail ou senha incorretos. Verifique suas credenciais.';
      if (error.message.includes('Invalid login credentials')) {
        userFriendlyMsg = 'E-mail ou senha incorretos.';
      } else if (error.message.includes('Email not confirmed')) {
        userFriendlyMsg = 'E-mail ainda não confirmado no Supabase.';
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        userFriendlyMsg = 'Sem conexão com o servidor. Verifique sua internet.';
      }

      showLoginError(userFriendlyMsg);
      btn.disabled = false;
      if (btnText) btnText.style.display = 'inline-flex';
      if (btnSpin) btnSpin.style.display = 'none';
      passInp.focus();
      return;
    }

    // 2. Autenticação bem-sucedida!
    const user = data?.user || { email };
    const token = data?.session?.access_token || 'mavic_session_active';
    // Expira em 30 dias se 'lembrar', ou em 24h
    const duration = remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const expiresAt = Date.now() + duration;

    const sessionObj = {
      email: user.email || email,
      id: user.id || 'admin',
      token: token,
      expiresAt: expiresAt,
      remember: remember
    };

    // Salva a sessão
    if (remember) {
      localStorage.setItem('mavic_admin_session', JSON.stringify(sessionObj));
      sessionStorage.removeItem('mavic_admin_session');
    } else {
      sessionStorage.setItem('mavic_admin_session', JSON.stringify(sessionObj));
      localStorage.removeItem('mavic_admin_session');
    }

    // Salva o último e-mail utilizado
    localStorage.setItem('mavic_last_email', email);

    showLoginSuccess('Autenticado com sucesso! Entrando no painel…');

    // Redireciona para o destino
    const urlParams = new URLSearchParams(window.location.search);
    let redirect = urlParams.get('redirect') || 'index.html';
    if (redirect.includes('login.html')) redirect = 'index.html';

    setTimeout(() => {
      window.location.replace(redirect);
    }, 450);

  } catch (err) {
    console.error('Erro no login:', err);
    showLoginError(err.message || 'Ocorreu um erro ao tentar entrar. Tente novamente.');
    btn.disabled = false;
    if (btnText) btnText.style.display = 'inline-flex';
    if (btnSpin) btnSpin.style.display = 'none';
  }
}

// Inicialização da página
document.addEventListener('DOMContentLoaded', async () => {
  // Configura tema
  const savedTheme = localStorage.getItem('mavic_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  // Preenche último e-mail ou o padrão
  const emailInp = document.getElementById('loginEmail');
  if (emailInp) {
    const lastEmail = localStorage.getItem('mavic_last_email') || 'projetos.mavic@hotmail.com';
    emailInp.value = lastEmail;
  }

  setupCapsLockDetector();

  // Se já tiver sessão ativa, redireciona
  await checkAlreadyLoggedIn();
});
