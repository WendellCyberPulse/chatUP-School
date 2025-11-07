// auth.js - Sistema completo de autenticação com username único

let usernameCheckTimeout = null;

// Navegação entre telas
function showWelcome() {
    document.getElementById('welcomeScreen').style.display = 'block';
    document.getElementById('signupScreen').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('successScreen').style.display = 'none';
}

function showSignup() {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('signupScreen').style.display = 'block';
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('successScreen').style.display = 'none';
    
    // Limpar formulário
    document.getElementById('displayName').value = '';
    document.getElementById('username').value = '';
    document.getElementById('usernameValidation').textContent = '';
    document.getElementById('usernameValidation').className = 'validation-message';
}

function showLogin() {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('signupScreen').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('successScreen').style.display = 'none';
    
    // Limpar formulário
    document.getElementById('loginUsername').value = '';
}

// Verificar disponibilidade do username em tempo real
function setupUsernameValidation() {
    const usernameInput = document.getElementById('username');
    
    usernameInput.addEventListener('input', function() {
        const username = this.value.trim().toLowerCase();
        const validationElement = document.getElementById('usernameValidation');
        
        // Limpar timeout anterior
        if (usernameCheckTimeout) {
            clearTimeout(usernameCheckTimeout);
        }
        
        if (username.length < 3) {
            validationElement.textContent = 'Mínimo 3 caracteres';
            validationElement.className = 'validation-message';
            return;
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            validationElement.textContent = 'Use apenas letras, números e _';
            validationElement.className = 'validation-message taken';
            return;
        }
        
        // Mostrar "verificando..."
        validationElement.textContent = 'Verificando disponibilidade...';
        validationElement.className = 'validation-message checking';
        
        // Debounce - esperar usuário parar de digitar
        usernameCheckTimeout = setTimeout(() => {
            checkUsernameAvailability(username);
        }, 500);
    });
}

// Verificar se username está disponível
function checkUsernameAvailability(username) {
    const validationElement = document.getElementById('usernameValidation');
    
    database.ref('usernames/' + username).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                validationElement.textContent = '❌ Este nome de usuário já está em uso';
                validationElement.className = 'validation-message taken';
            } else {
                validationElement.textContent = '✅ Nome de usuário disponível';
                validationElement.className = 'validation-message available';
            }
        })
        .catch(error => {
            console.error('Erro ao verificar username:', error);
            validationElement.textContent = 'Erro ao verificar disponibilidade';
            validationElement.className = 'validation-message';
        });
}

// Criar novo usuário
function createUser(event) {
    event.preventDefault();
    
    if (!checkFirebase()) return;
    
    const displayName = document.getElementById('displayName').value.trim();
    const username = document.getElementById('username').value.trim().toLowerCase();
    
    // Validações (manter as mesmas)
    if (!displayName) {
        alert('Por favor, digite seu nome de exibição!');
        return;
    }
    
    if (!username) {
        alert('Por favor, digite um nome de usuário!');
        return;
    }
    
    if (username.length < 3) {
        alert('O nome de usuário deve ter pelo menos 3 caracteres!');
        return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        alert('Use apenas letras, números e underscore no nome de usuário!');
        return;
    }
    
    // Desabilitar botão
    const signupBtn = document.getElementById('signupBtn');
    signupBtn.disabled = true;
    signupBtn.textContent = 'Criando conta...';
    
    // Verificar username novamente (para garantir)
    database.ref('usernames/' + username).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                throw new Error('Nome de usuário já está em uso');
            }
            
            // Criar usuário - AGORA SALVANDO COM USERNAME COMO ID
            const userData = {
                displayName: displayName,
                username: username,
                createdAt: Date.now(),
                lastSeen: Date.now(),
                isOnline: true
            };
            
            // Salvar usuário (usando username como ID)
            return database.ref('users/' + username).set(userData);
        })
        .then(() => {
            // Salvar relação username -> userId
            return database.ref('usernames/' + username).set(true);
        })
        .then(() => {
            // Mostrar tela de sucesso
            showSuccessScreen(displayName, username);
        })
        .catch(error => {
            console.error('Erro ao criar usuário:', error);
            alert(error.message || 'Erro ao criar usuário. Tente novamente.');
        })
        .finally(() => {
            signupBtn.disabled = false;
            signupBtn.textContent = 'Criar Conta';
        });
}

// Mostrar tela de sucesso
function showSuccessScreen(displayName, username) {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('signupScreen').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('successScreen').style.display = 'block';
    
    document.getElementById('successDisplayName').textContent = displayName;
    document.getElementById('successUsername').textContent = username;
    document.getElementById('successAvatar').textContent = displayName.charAt(0).toUpperCase();
}

// Login com username
function loginUser(event) {
    event.preventDefault();
    
    if (!checkFirebase()) return;
    
    const username = document.getElementById('loginUsername').value.trim().toLowerCase();
    
    if (!username) {
        alert('Por favor, digite seu nome de usuário!');
        return;
    }
    
    // Verificar se usuário existe
    database.ref('users/' + username).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                
                // Atualizar status para online
                return database.ref('users/' + username).update({
                    isOnline: true,
                    lastSeen: Date.now()
                }).then(() => userData);
            } else {
                throw new Error('Usuário não encontrado!');
            }
        })
        .then(userData => {
            // Salvar usuário no sessionStorage e ir para chat
            sessionStorage.setItem('currentUser', JSON.stringify({
                id: username, // Agora o ID é o username
                username: username,
                displayName: userData.displayName
            }));
            
            window.location.href = 'chat.html';
        })
        .catch(error => {
            console.error('Erro ao fazer login:', error);
            alert(error.message || 'Erro ao fazer login. Tente novamente.');
        });
}

// Ir para o chat
function goToChat() {
    const displayName = document.getElementById('successDisplayName').textContent;
    const username = document.getElementById('successUsername').textContent;
    
    sessionStorage.setItem('currentUser', JSON.stringify({
        id: username,
        username: username,
        displayName: displayName
    }));
    
    window.location.href = 'chat.html';
}

// Verificar Firebase
function checkFirebase() {
    if (typeof firebase === 'undefined' || !window.database) {
        alert('Sistema não carregou corretamente. Recarregue a página.');
        return false;
    }
    return true;
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    setupUsernameValidation();
    
    // Enter nos formulários
    document.getElementById('displayName')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') document.getElementById('username').focus();
    });
    
    document.getElementById('username')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') document.getElementById('signupBtn').click();
    });
    
    document.getElementById('loginUsername')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') document.querySelector('#loginScreen .btn').click();
    });
    
    // Verificar se já está logado
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        window.location.href = 'chat.html';
    }
});