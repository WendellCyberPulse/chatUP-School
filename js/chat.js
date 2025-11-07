// chat.js - Sistema completo de amigos e chat
let currentUser = null;
let currentChat = null;
let friends = {};
let pendingRequests = 0;

// ========== SISTEMA DE TEMAS ==========
function initTheme() {
    // Verificar tema salvo ou preferência do sistema
    const savedTheme = localStorage.getItem('chatup-theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    let theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    
    // Aplicar tema
    applyTheme(theme);
    updateThemeButton(theme);
    
    console.log('🎨 Tema carregado:', theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    applyTheme(newTheme);
    updateThemeButton(newTheme);
    
    // Salvar preferência
    localStorage.setItem('chatup-theme', newTheme);
    
    console.log('🔄 Tema alterado para:', newTheme);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

function updateThemeButton(theme) {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    
    if (theme === 'dark') {
        themeToggle.innerHTML = '<span class="theme-icon">☀️</span><span class="theme-text">Modo Claro</span>';
    } else {
        themeToggle.innerHTML = '<span class="theme-icon">🌙</span><span class="theme-text">Modo Escuro</span>';
    }
}

// ========== INICIALIZAÇÃO ==========
function initChat() {
    console.log('🚀 Iniciando chat...');

    initTheme();

    initResponsive();

    // 🎯 ATIVAR MONITORAMENTO AUTOMÁTICO DE ESPAÇO
    configurarMonitoramentoEspaco();
    
    // Verificar se usuário está logado
    const savedUser = sessionStorage.getItem('currentUser');
    
    if (!savedUser) {
        console.log('❌ Nenhum usuário logado, redirecionando...');
        window.location.href = 'index.html';
        return;
    }

    currentUser = JSON.parse(savedUser);
    console.log('👤 Usuário atual:', currentUser);

    // Configurar sistemas de status
    setupMessageStatusListener();
    setupReadStatusListener();
    setupTypingIndicator();
    
    
    // Atualizar interface
    updateUserInterface();
    
    // Configurar abas
    setupTabs();
    
    // Configurar listeners do Firebase
    setupFirebaseListeners();
    
    // Atualizar status para online
    updateUserStatus(true);
    
    // Configurar eventos
    setupEventListeners();
}

function updateUserInterface() {
    document.getElementById('currentUserName').textContent = currentUser.displayName;
    document.getElementById('currentUserId').textContent = currentUser.id;
    document.getElementById('currentUserAvatar').textContent = currentUser.displayName.charAt(0).toUpperCase();
}

function setupEventListeners() {
    // Enter para enviar mensagem
    document.getElementById('messageInput')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
}

// ========== SISTEMA DE ABAS ==========

function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');

            // Remover ativo de tudo
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            // Ativar botão clicado
            this.classList.add('active');

            // Ativar a aba correspondente
            const targetPaneId = tabName === 'requests' ? 'requestsPane' : tabName + 'Tab';
            const targetPane = document.getElementById(targetPaneId);
            if (targetPane) targetPane.classList.add('active');

            // Carregar conteúdo
            if (tabName === 'friends') {
                loadFriendsList();
            } else if (tabName === 'search') {
                setupSearch();
            } else if (tabName === 'requests') {
                loadFriendRequests();
            }
        });
    });

    // Eventos de busca
    document.getElementById('friendSearch').addEventListener('input', filterFriends);
    document.getElementById('userSearch').addEventListener('input', searchUsers);

    // Ativar primeira aba por padrão
    tabBtns[0]?.click();
}


function limparSolicitacoesDeAbasErradas(abaAtiva) {
    if (abaAtiva !== 'requests') {
        // Se não estamos na aba de solicitações, limpar qualquer solicitação que apareceu errado
        const friendsList = document.getElementById('friendsList');
        const searchResults = document.getElementById('searchResults');
        
        // Remover itens de solicitação que possam ter sido adicionados erroneamente
        if (friendsList) {
            const solicitacoesErradas = friendsList.querySelectorAll('.user-item[id^="request-"]');
            solicitacoesErradas.forEach(item => item.remove());
        }
        
        if (searchResults) {
            const solicitacoesErradas = searchResults.querySelectorAll('.user-item[id^="request-"]');
            solicitacoesErradas.forEach(item => item.remove());
        }
    }
}

// Atualizar cache quando um novo amigo é adicionado
function updateFriendsCache() {
    database.ref('friendships').orderByChild('status').equalTo('accepted').on('value', snapshot => {
        if (!snapshot.exists()) {
            friendsCache = {};
            friendsListLoaded = true;
            return;
        }
        
        const friendships = snapshot.val();
        const friendUsernames = [];
        
        // Coletar usernames dos amigos
        Object.keys(friendships).forEach(friendshipId => {
            const friendship = friendships[friendshipId];
            if (friendship.user1 === currentUser.id) {
                friendUsernames.push(friendship.user2);
            } else if (friendship.user2 === currentUser.id) {
                friendUsernames.push(friendship.user1);
            }
        });
        
        // Buscar dados atualizados dos amigos
        const friendsPromises = friendUsernames.map(username => {
            return database.ref('users/' + username).once('value');
        });
        
        Promise.all(friendsPromises).then(snapshots => {
            const newCache = {};
            
            snapshots.forEach(snapshot => {
                if (snapshot.exists()) {
                    const friend = snapshot.val();
                    newCache[friend.username] = friend;
                }
            });
            
            // Atualizar cache
            friendsCache = newCache;
            friendsListLoaded = true;
            
            // Se estiver na aba de amigos, atualizar a lista
            if (document.querySelector('#friendsTab').classList.contains('active')) {
                renderFriendsFromCache();
            }
            
            console.log(`🔄 Cache de amigos atualizado: ${Object.keys(friendsCache).length} amigos`);
        });
    });
}

// ========== FIREBASE LISTENERS ==========
function setupFirebaseListeners() {
    console.log('📡 Configurando listeners do Firebase...');
    
    // Listener para amizades - recarrega sempre que houver mudança
    database.ref('friendships').orderByChild('status').equalTo('accepted').on('value', (snapshot) => {
        console.log('🔄 Amizades atualizadas, recarregando lista...');
        loadFriendsList();
    });
    
    // Manter os outros listeners originais
    database.ref('friend_requests').orderByChild('to').equalTo(currentUser.id).on('value', (snapshot) => {
        loadFriendRequests(snapshot);
    });
    
    database.ref('users').on('value', (snapshot) => {
        updateUsersStatus(snapshot);
    });
}

// ========== SISTEMA DE AMIGOS ==========
let friendsCache = {};
let friendsListLoaded = false;

function loadFriendsList() {
    const friendsList = document.getElementById('friendsList');
    console.log('🔄 Carregando lista de amigos...');
    
    friendsList.innerHTML = '<div class="loading">Carregando amigos...</div>';

    // Buscar TODAS as amizades do banco
    database.ref('friendships').once('value')
        .then(snapshot => {
            if (!snapshot.exists()) {
                friendsList.innerHTML = '<div class="info-message">Você ainda não tem amigos</div>';
                return;
            }

            const friendships = snapshot.val();
            const friendUsernames = [];

            // Procurar amizades onde o usuário atual está envolvido
            Object.keys(friendships).forEach(friendshipId => {
                const friendship = friendships[friendshipId];
                
                // Verificar se é uma amizade aceita do usuário atual
                if (friendship.status === 'accepted') {
                    if (friendship.user1 === currentUser.id) {
                        friendUsernames.push(friendship.user2);
                    } else if (friendship.user2 === currentUser.id) {
                        friendUsernames.push(friendship.user1);
                    }
                }
            });

            console.log(`👥 Amigos encontrados: ${friendUsernames.length}`, friendUsernames);

            if (friendUsernames.length === 0) {
                friendsList.innerHTML = '<div class="info-message">Você ainda não tem amigos</div>';
                return;
            }

            // Buscar informações de cada amigo
            const promises = friendUsernames.map(username => {
                return database.ref('users/' + username).once('value');
            });

            return Promise.all(promises);
        })
        .then(snapshots => {
            if (!snapshots) return;

            const friendsList = document.getElementById('friendsList');
            friendsList.innerHTML = '';

            snapshots.forEach(snapshot => {
                if (snapshot.exists()) {
                    const friend = snapshot.val();
                    addFriendToDisplay(friend);
                }
            });

            if (friendsList.children.length === 0) {
                friendsList.innerHTML = '<div class="info-message">Nenhum amigo carregado</div>';
            } else {
                console.log(`✅ ${friendsList.children.length} amigos exibidos na lista`);
            }
        })
        .catch(error => {
            console.error('❌ Erro ao carregar amigos:', error);
            friendsList.innerHTML = '<div class="info-message">Erro ao carregar amigos</div>';
        });
}

// Função auxiliar para adicionar amigo na lista
// Função auxiliar para adicionar amigo na lista (CORRIGIDA)
function addFriendToDisplay(friend) {
    const friendsList = document.getElementById('friendsList');
    
    // Verificar se os dados do amigo são válidos
    if (!friend || !friend.username || !friend.displayName) {
        console.warn('❌ Dados inválidos do amigo:', friend);
        return; // Não adiciona se dados estiverem incompletos
    }
    
    const friendItem = document.createElement('div');
    friendItem.className = 'user-item';
    friendItem.onclick = () => startChat(friend.username, friend.displayName);
    
    // Garantir que temos valores válidos
    const displayName = friend.displayName || 'Usuário';
    const username = friend.username || 'desconhecido';
    const isOnline = friend.isOnline || false;
    const lastSeen = friend.lastSeen || Date.now();
    
    friendItem.innerHTML = `
        <div class="user-avatar-small">${displayName.charAt(0).toUpperCase()}</div>
        <div class="user-details">
            <div class="user-name">${displayName}</div>
            <div class="user-username">@${username}</div>
            <div class="user-status ${isOnline ? 'status-online' : 'status-offline'}">
                <span class="status-dot"></span>
                ${isOnline ? 'Online' : 'Último visto ' + formatLastSeen(lastSeen)}
            </div>
        </div>
    `;
    
    friendsList.appendChild(friendItem);
}

// Renderizar amigos do cache
function renderFriendsFromCache() {
    const friendsList = document.getElementById('friendsList');
    friendsList.innerHTML = '';
    
    if (Object.keys(friendsCache).length === 0) {
        friendsList.innerHTML = '<div class="info-message">Você ainda não tem amigos</div>';
        return;
    }
    
    Object.values(friendsCache).forEach(friend => {
        addFriendToList(friend);
    });
    
    console.log(`⚡ ${Object.keys(friendsCache).length} amigos renderizados do cache`);
}

// Adicionar amigo à lista (agora atualiza o cache também)
function addFriendToList(friend) {
    const friendsList = document.getElementById('friendsList');
    
    // Atualizar cache
    friendsCache[friend.username] = friend;
    
    const friendItem = document.createElement('div');
    friendItem.className = 'user-item';
    friendItem.onclick = () => startChat(friend.username, friend.displayName);
    
    friendItem.innerHTML = `
        <div class="user-avatar-small">${friend.displayName.charAt(0).toUpperCase()}</div>
        <div class="user-details">
            <div class="user-name">${friend.displayName}</div>
            <div class="user-username">@${friend.username}</div>
            <div class="user-status ${friend.isOnline ? 'status-online' : 'status-offline'}">
                <span class="status-dot"></span>
                ${friend.isOnline ? 'Online' : 'Último visto ' + formatLastSeen(friend.lastSeen)}
            </div>
        </div>
        ${!friend.isOnline ? '<div class="offline-indicator" title="Offline">🔴</div>' : ''}
    `;
    
    friendsList.appendChild(friendItem);
}

function addFriendToList(friend) {
    const friendsList = document.getElementById('friendsList');
    
    const friendItem = document.createElement('div');
    friendItem.className = 'user-item';
    friendItem.onclick = () => startChat(friend.username, friend.displayName);
    
    friendItem.innerHTML = `
        <div class="user-avatar-small">${friend.displayName.charAt(0).toUpperCase()}</div>
        <div class="user-details">
            <div class="user-name">${friend.displayName}</div>
            <div class="user-username">@${friend.username}</div>
            <div class="user-status ${friend.isOnline ? 'status-online' : 'status-offline'}">
                <span class="status-dot"></span>
                ${friend.isOnline ? 'Online' : 'Último visto ' + formatLastSeen(friend.lastSeen)}
            </div>
        </div>
        ${!friend.isOnline ? '<div class="offline-indicator" title="Offline">🔴</div>' : ''}
    `;
    
    friendsList.appendChild(friendItem);
}

function filterFriends() {
    const searchTerm = document.getElementById('friendSearch').value.toLowerCase();
    const friendItems = document.querySelectorAll('#friendsList .user-item');
    
    friendItems.forEach(item => {
        const userName = item.querySelector('.user-name').textContent.toLowerCase();
        const userUsername = item.querySelector('.user-username').textContent.toLowerCase();
        
        if (userName.includes(searchTerm) || userUsername.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// ========== SISTEMA DE BUSCA ==========
function setupSearch() {
    document.getElementById('userSearch').value = '';
    document.getElementById('searchResults').innerHTML = `
        <div class="info-message">
            Digite um username para buscar usuários
        </div>
    `;
}

function searchUsers() {
    const searchTerm = document.getElementById('userSearch').value.trim().toLowerCase();
    const searchResults = document.getElementById('searchResults');
    
    if (searchTerm.length < 2) {
        searchResults.innerHTML = '<div class="info-message">Digite pelo menos 2 caracteres</div>';
        return;
    }
    
    searchResults.innerHTML = '<div class="loading">Buscando usuários...</div>';
    
    // Buscar usuários com regras mais específicas
    database.ref('users').orderByChild('username').startAt(searchTerm).endAt(searchTerm + '\uf8ff')
        .once('value')
        .then(snapshot => {
            searchResults.innerHTML = '';
            
            if (!snapshot.exists()) {
                searchResults.innerHTML = '<div class="info-message">Nenhum usuário encontrado</div>';
                return;
            }
            
            const users = snapshot.val();
            let foundUsers = false;
            
            Object.keys(users).forEach(username => {
                const user = users[username];
                
                // Não mostrar o usuário atual
                if (username !== currentUser.id) {
                    foundUsers = true;
                    addUserToSearchResults(user);
                }
            });
            
            if (!foundUsers) {
                searchResults.innerHTML = '<div class="info-message">Nenhum usuário encontrado</div>';
            }
        })
        .catch(error => {
            console.error('Erro na busca:', error);
            
            // Fallback: buscar todos e filtrar localmente
            fallbackSearch(searchTerm);
        });
}

// Fallback para quando as regras não permitem busca por range
function fallbackSearch(searchTerm) {
    database.ref('users').once('value')
        .then(snapshot => {
            const searchResults = document.getElementById('searchResults');
            searchResults.innerHTML = '';
            
            if (!snapshot.exists()) {
                searchResults.innerHTML = '<div class="info-message">Nenhum usuário encontrado</div>';
                return;
            }
            
            const users = snapshot.val();
            let foundUsers = false;
            
            Object.keys(users).forEach(username => {
                const user = users[username];
                
                // Filtrar localmente
                if (username !== currentUser.id && 
                    (user.username.toLowerCase().includes(searchTerm) || 
                     user.displayName.toLowerCase().includes(searchTerm))) {
                    foundUsers = true;
                    addUserToSearchResults(user);
                }
            });
            
            if (!foundUsers) {
                searchResults.innerHTML = '<div class="info-message">Nenhum usuário encontrado</div>';
            }
        })
        .catch(error => {
            console.error('Erro no fallback search:', error);
            document.getElementById('searchResults').innerHTML = 
                '<div class="info-message">Erro ao buscar usuários</div>';
        });
}

// ========== SISTEMA DE BUSCA ATUALIZADO ==========
function addUserToSearchResults(user) {
    const searchResults = document.getElementById('searchResults');
    
    const userItem = document.createElement('div');
    userItem.className = 'user-item';
    
    // Verificar status da amizade
    const friendshipId = getFriendshipId(currentUser.id, user.username);
    
    // Primeiro verifica se já é amigo
    database.ref('friendships/' + friendshipId).once('value')
        .then(snapshot => {
            let buttonHtml = '';
            
            if (snapshot.exists()) {
                const friendship = snapshot.val();
                if (friendship.status === 'accepted') {
                    buttonHtml = '<button class="btn-small btn-secondary" disabled>Amigo</button>';
                } else {
                    buttonHtml = '<button class="btn-small btn-secondary" disabled>Solicitado</button>';
                }
                
                // Adiciona o item com o botão já definido
                userItem.innerHTML = `
                    <div class="user-avatar-small">${user.displayName.charAt(0).toUpperCase()}</div>
                    <div class="user-details">
                        <div class="user-name">${user.displayName}</div>
                        <div class="user-username">@${user.username}</div>
                        <div class="user-status ${user.isOnline ? 'status-online' : 'status-offline'}">
                            <span class="status-dot"></span>
                            ${user.isOnline ? 'Online' : 'Offline'}
                        </div>
                    </div>
                    <div class="user-actions">
                        ${buttonHtml}
                    </div>
                `;
                
                searchResults.appendChild(userItem);
            } else {
                // Se não é amigo, verifica se há solicitação pendente
                database.ref('friend_requests/' + friendshipId).once('value')
                    .then(requestSnapshot => {
                        if (requestSnapshot.exists() && requestSnapshot.val().status === 'pending') {
                            buttonHtml = '<button class="btn-small btn-secondary" disabled>Solicitado</button>';
                        } else {
                            buttonHtml = `<button class="btn-small btn-primary" onclick="sendFriendRequest('${user.username}')">
                                Adicionar
                            </button>`;
                        }
                        
                        // Adiciona o item com o botão definido
                        userItem.innerHTML = `
                            <div class="user-avatar-small">${user.displayName.charAt(0).toUpperCase()}</div>
                            <div class="user-details">
                                <div class="user-name">${user.displayName}</div>
                                <div class="user-username">@${user.username}</div>
                                <div class="user-status ${user.isOnline ? 'status-online' : 'status-offline'}">
                                    <span class="status-dot"></span>
                                    ${user.isOnline ? 'Online' : 'Offline'}
                                </div>
                            </div>
                            <div class="user-actions">
                                ${buttonHtml}
                            </div>
                        `;
                        
                        searchResults.appendChild(userItem);
                    })
                    .catch(error => {
                        console.error('Erro ao verificar solicitação:', error);
                    });
            }
        })
        .catch(error => {
            console.error('Erro ao verificar amizade:', error);
        });
}

// ========== SOLICITAÇÕES DE AMIZADE ==========
function sendFriendRequest(toUsername) {
    const friendshipId = getFriendshipId(currentUser.id, toUsername);
    
    const requestData = {
        from: currentUser.id,
        to: toUsername,
        status: 'pending',
        sentAt: Date.now()
    };
    
    database.ref('friend_requests/' + friendshipId).set(requestData)
        .then(() => {
            console.log('✅ Solicitação enviada para:', toUsername);
            showNotification('Solicitação de amizade enviada!');
        })
        .catch(error => {
            console.error('❌ Erro ao enviar solicitação:', error);
            showNotification('Erro ao enviar solicitação', 'error');
        });
}

// ========== SOLICITAÇÕES DE AMIZADE 2 ==========
function loadFriendRequests(snapshot = null) {
    const requestsBadge = document.getElementById('requestsBadge');
    const requestsList = document.getElementById('requestsList');
    
    if (!requestsList) return;
    requestsList.innerHTML = '<div class="loading">Carregando solicitações...</div>';
    
    // Buscar do Firebase se não houver snapshot
    if (!snapshot) {
        database.ref('friend_requests')
            .orderByChild('to')
            .equalTo(currentUser.id)
            .once('value')
            .then(loadFriendRequests);
        return;
    }
    
    requestsList.innerHTML = '';
    let pendingCount = 0;
    
    if (!snapshot.exists()) {
        requestsList.innerHTML = '<div class="info-message">Nenhuma solicitação pendente</div>';
        if (requestsBadge) requestsBadge.style.display = 'none';
        return;
    }
    
    const requests = snapshot.val();
    const promises = [];

    Object.keys(requests).forEach(id => {
        const req = requests[id];
        if (req.status === 'pending' && req.to === currentUser.id) {
            pendingCount++;
            promises.push(
                database.ref('users/' + req.from).once('value')
                    .then(userSnap => {
                        if (!userSnap.exists()) return;
                        const user = userSnap.val();

                        const item = document.createElement('div');
                        item.className = 'user-item';
                        item.id = `request-${req.from}`;
                        item.innerHTML = `
                            <div class="user-avatar-small">${user.displayName.charAt(0).toUpperCase()}</div>
                            <div class="user-details">
                                <div class="user-name">${user.displayName}</div>
                                <div class="user-username">@${user.username}</div>
                                <div class="user-status">Solicitação de amizade</div>
                            </div>
                            <div class="user-actions">
                                <button class="btn-small btn-success" onclick="acceptFriendRequest('${req.from}', '${user.displayName}')">Aceitar</button>
                                <button class="btn-small btn-danger" onclick="rejectFriendRequest('${req.from}')">Recusar</button>
                            </div>
                        `;
                        requestsList.appendChild(item);
                    })
            );
        }
    });

    Promise.all(promises).then(() => {
        if (pendingCount === 0) {
            requestsList.innerHTML = '<div class="info-message">Nenhuma solicitação pendente</div>';
            if (requestsBadge) requestsBadge.style.display = 'none';
        } else {
            if (requestsBadge) {
                requestsBadge.textContent = pendingCount;
                requestsBadge.style.display = 'inline';
            }
        }
    });
}


function addRequestToCorrectTab(request, user) {
    const requestsList = document.getElementById('requestsList');
    
    // Verificar se estamos na aba de solicitações
    if (!requestsList) {
        console.log('⚠️ Não está na aba de solicitações, ignorando...');
        return;
    }
    
    const requestItem = document.createElement('div');
    requestItem.className = 'user-item';
    requestItem.id = `request-${request.from}`;
    
    requestItem.innerHTML = `
        <div class="user-avatar-small">${user.displayName.charAt(0).toUpperCase()}</div>
        <div class="user-details">
            <div class="user-name">${user.displayName}</div>
            <div class="user-username">@${user.username}</div>
            <div class="user-status">
                <span class="status-dot"></span>
                Solicitação de amizade
            </div>
        </div>
        <div class="user-actions">
            <button class="btn-small btn-success" onclick="acceptFriendRequest('${request.from}', '${user.displayName}')">
                Aceitar
            </button>
            <button class="btn-small btn-danger" onclick="rejectFriendRequest('${request.from}')">
                Recusar
            </button>
        </div>
    `;
    
    requestsList.appendChild(requestItem);
}
// Função simplificada para adicionar solicitação
function addRequestToList(request, user) {
    const requestsList = document.getElementById('requestsList');
    
    const requestItem = document.createElement('div');
    requestItem.className = 'user-item';
    requestItem.id = `request-${request.from}`;
    
    requestItem.innerHTML = `
        <div class="user-avatar-small">${user.displayName.charAt(0).toUpperCase()}</div>
        <div class="user-details">
            <div class="user-name">${user.displayName}</div>
            <div class="user-username">@${user.username}</div>
            <div class="user-status">
                <span class="status-dot"></span>
                Solicitação de amizade
            </div>
        </div>
        <div class="user-actions">
            <button class="btn-small btn-success" onclick="acceptFriendRequest('${request.from}', '${user.displayName}')">
                Aceitar
            </button>
            <button class="btn-small btn-danger" onclick="rejectFriendRequest('${request.from}')">
                Recusar
            </button>
        </div>
    `;
    
    requestsList.appendChild(requestItem);
}

// Aplicar estilos CSS imediatamente





function addRequestToList(request) {
    const requestsList = document.getElementById('requestsList');
    
    console.log('🔄 Adicionando solicitação à lista:', request.from);
    
    if (!requestsList) {
        console.error('❌ requestsList não encontrado!');
        return;
    }
    
    // Buscar dados do usuário que enviou a solicitação
    database.ref('users/' + request.from).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                const user = snapshot.val();
                console.log('✅ Dados do usuário carregados:', user.displayName);
                
                // Criar elemento HTML
                const requestItem = document.createElement('div');
                requestItem.className = 'user-item';
                requestItem.id = `request-${request.from}`;
                
                requestItem.innerHTML = `
                    <div class="user-avatar-small">${user.displayName.charAt(0).toUpperCase()}</div>
                    <div class="user-details">
                        <div class="user-name">${user.displayName}</div>
                        <div class="user-username">@${user.username}</div>
                        <div class="user-status">Solicitação de amizade</div>
                    </div>
                    <div class="user-actions">
                        <button class="btn-small btn-success" onclick="acceptFriendRequest('${request.from}', '${user.displayName}')">
                            Aceitar
                        </button>
                        <button class="btn-small btn-danger" onclick="rejectFriendRequest('${request.from}')">
                            Recusar
                        </button>
                    </div>
                `;
                
                // Adicionar à lista
                requestsList.appendChild(requestItem);
                console.log('✅ Solicitação adicionada à interface:', requestItem);
                
            } else {
                console.error('❌ Usuário não encontrado:', request.from);
            }
        })
        .catch(error => {
            console.error('❌ Erro ao carregar usuário:', error);
        });
}







function acceptFriendRequest(fromUsername, fromDisplayName) {
    console.log('✅ Aceitando solicitação de:', fromUsername);
    
    const friendshipId = getFriendshipId(currentUser.id, fromUsername);
    
    // Criar amizade
    const friendshipData = {
        user1: currentUser.id,
        user2: fromUsername,
        status: 'accepted',
        createdAt: Date.now()
    };
    
    console.log('💾 Salvando amizade:', friendshipData);
    
    database.ref('friendships/' + friendshipId).set(friendshipData)
        .then(() => {
            console.log('✅ Amizade salva no Firebase');
            // Remover solicitação
            return database.ref('friend_requests/' + friendshipId).remove();
        })
        .then(() => {
            console.log('✅ Solicitação removida do Firebase');
            showNotification(`Agora você é amigo de ${fromDisplayName}!`);
            
            // Atualizar a lista de solicitações
            loadFriendRequests();
            
            // Atualizar a lista de amigos
            loadFriendsList();
            
            console.log('✅ Listas atualizadas');
        })
        .catch(error => {
            console.error('❌ Erro ao aceitar amizade:', error);
            showNotification('Erro ao aceitar amizade', 'error');
        });
}


function rejectFriendRequest(fromUsername) {
    console.log('❌ Recusando solicitação de:', fromUsername);
    
    const friendshipId = getFriendshipId(currentUser.id, fromUsername);
    
    database.ref('friend_requests/' + friendshipId).remove()
        .then(() => {
            console.log('✅ Solicitação removida do Firebase');
            showNotification('Solicitação recusada');
            
            // Remover o item da lista
            const requestItem = document.getElementById(`request-${fromUsername}`);
            if (requestItem) {
                requestItem.remove();
            }
            
            // Atualizar contador
            loadFriendRequests();
        })
        .catch(error => {
            console.error('❌ Erro ao recusar solicitação:', error);
            showNotification('Erro ao recusar solicitação', 'error');
        });
}

function getFriendshipId(user1, user2) {
    return [user1, user2].sort().join('_');
}

// ========== SISTEMA DE CHAT (FUNÇÕES ORIGINAIS) ==========
// ========== SISTEMA DE STATUS DE MENSAGENS ==========

// Atualizar status da mensagem
function updateMessageStatus(messageKey, chatId, status) {
    const updates = {};
    updates[`chats/${chatId}/messages/${messageKey}/status`] = status;
    updates[`chats/${chatId}/messages/${messageKey}/statusTimestamp`] = Date.now();
    
    database.ref().update(updates)
        .then(() => {
            console.log(`✅ Status da mensagem atualizado para: ${status}`);
        })
        .catch(error => {
            console.error('❌ Erro ao atualizar status:', error);
        });
}

// Verificar se o destinatário está online e atualizar status
function setupMessageStatusListener() {
    // Listener para novas mensagens
    database.ref('users').on('value', (snapshot) => {
        if (!currentChat || !snapshot.exists()) return;
        
        const users = snapshot.val();
        const recipient = users[currentChat.id];
        
        if (recipient && recipient.isOnline) {
            // Destinatário está online, marcar mensagens como entregues
            markMessagesAsDelivered();
        }
    });
}

// Marcar mensagens como entregues
function markMessagesAsDelivered() {
    if (!currentChat) return;
    
    const chatId = generateChatId(currentUser.id, currentChat.id);
    
    database.ref(`chats/${chatId}/messages`).once('value')
        .then((snapshot) => {
            if (!snapshot.exists()) return;
            
            const messages = snapshot.val();
            const updates = {};
            
            Object.keys(messages).forEach((key) => {
                const message = messages[key];
                // Se a mensagem é do usuário atual e ainda não foi entregue
                if (message.sender === currentUser.id && message.status === 'sent') {
                    updates[`chats/${chatId}/messages/${key}/status`] = 'delivered';
                    updates[`chats/${chatId}/messages/${key}/statusTimestamp`] = Date.now();
                }
            });
            
            if (Object.keys(updates).length > 0) {
                return database.ref().update(updates);
            }
        })
        .then(() => {
            console.log('✅ Mensagens marcadas como entregues');
        })
        .catch(error => {
            console.error('❌ Erro ao marcar mensagens como entregues:', error);
        });
}

// Marcar mensagens como lidas (quando o chat está aberto)
function markMessagesAsRead() {
    if (!currentChat) return;
    
    const chatId = generateChatId(currentUser.id, currentChat.id);
    
    database.ref(`chats/${chatId}/messages`).once('value')
        .then((snapshot) => {
            if (!snapshot.exists()) return;
            
            const messages = snapshot.val();
            const updates = {};
            
            Object.keys(messages).forEach((key) => {
                const message = messages[key];
                // Se a mensagem é do outro usuário e ainda não foi lida
                if (message.sender === currentChat.id && message.status !== 'read') {
                    updates[`chats/${chatId}/messages/${key}/status`] = 'read';
                    updates[`chats/${chatId}/messages/${key}/statusTimestamp`] = Date.now();
                }
            });
            
            if (Object.keys(updates).length > 0) {
                return database.ref().update(updates);
            }
        })
        .then(() => {
            console.log('✅ Mensagens marcadas como lidas');
        })
        .catch(error => {
            console.error('❌ Erro ao marcar mensagens como lidas:', error);
        });
}

// Verificar se o chat está visível para marcar como lido
function setupReadStatusListener() {
    // Marcar como lido quando o chat ficar visível
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && currentChat) {
            markMessagesAsRead();
        }
    });
    
    // Marcar como lido quando o usuário interagir com a página
    document.addEventListener('click', function() {
        if (currentChat) {
            markMessagesAsRead();
        }
    });
    
    // Marcar como lido quando receber novas mensagens
    if (currentChat) {
        const chatId = generateChatId(currentUser.id, currentChat.id);
        database.ref(`chats/${chatId}/messages`).on('child_changed', (snapshot) => {
            const message = snapshot.val();
            if (message.sender === currentChat.id) {
                markMessagesAsRead();
            }
        });
    }
}
function startChat(username, displayName) {
    console.log('💬 Iniciando chat com:', displayName, username);
    
    currentChat = {
        id: username,
        name: displayName
    };

    // Atualizar interface
    document.getElementById('noChatSelected').style.display = 'none';
    document.getElementById('activeChatHeader').style.display = 'flex';
    document.getElementById('activeChatName').textContent = displayName;
    document.getElementById('activeChatAvatar').textContent = displayName.charAt(0).toUpperCase();
    
    // Atualizar status
    const friend = friends[username];
    document.getElementById('activeChatStatus').textContent = friend && friend.isOnline ? 'Online' : 'Offline';
    document.getElementById('activeChatStatus').className = `user-status ${friend && friend.isOnline ? 'status-online' : 'status-offline'}`;
    
    // Mostrar área de input
    document.getElementById('chatInput').style.display = 'flex';
    
    // Carregar mensagens
    loadChatMessages();
    
    // Focar no input
    document.getElementById('messageInput').focus();
}

function loadChatMessages() {
    const chatId = generateChatId(currentUser.id, currentChat.id);
    const messagesContainer = document.getElementById('chatMessages');
    
    console.log('📨 Carregando mensagens do chat:', chatId);
    
    // Limpar mensagens anteriores
    database.ref('chats/' + chatId + '/messages').off();
    
    // Listener para novas mensagens
    database.ref('chats/' + chatId + '/messages').on('child_added', (snapshot) => {
        const message = snapshot.val();
        message.key = snapshot.key; // Adicionar a chave da mensagem
        displayMessage(message);
        scrollToBottom();
    });
    
    // Listener para atualizações de status
    database.ref('chats/' + chatId + '/messages').on('child_changed', (snapshot) => {
        const updatedMessage = snapshot.val();
        updatedMessage.key = snapshot.key;
        updateMessageDisplay(updatedMessage);
    });
    
    // Carregar mensagens existentes
    database.ref('chats/' + chatId + '/messages').once('value')
        .then((snapshot) => {
            if (!snapshot.exists()) {
                messagesContainer.innerHTML = `
                    <div class="welcome-message">
                        <p>Nenhuma mensagem ainda. Inicie a conversa!</p>
                    </div>
                `;
                return;
            }
            
            const messages = snapshot.val();
            const messagesArray = [];
            
            Object.keys(messages).forEach((key) => {
                const message = messages[key];
                message.key = key;
                messagesArray.push(message);
            });
            
            // Ordenar por timestamp
            messagesArray.sort((a, b) => a.timestamp - b.timestamp);
            
            // Exibir mensagens
            messagesArray.forEach((message) => {
                displayMessage(message);
            });
            
            scrollToBottom();
            
            // Marcar mensagens como lidas
            markMessagesAsRead();
        })
        .catch((error) => {
            console.error('❌ Erro ao carregar mensagens:', error);
            messagesContainer.innerHTML = '<div class="welcome-message"><p>Erro ao carregar mensagens</p></div>';
        });
}

// Atualizar display da mensagem quando o status mudar
function updateMessageDisplay(message) {
    const messageElement = document.getElementById(`message-${message.messageId || message.key}`);
    if (!messageElement) return;
    
    const statusElement = messageElement.querySelector('.message-status');
    if (statusElement) {
        statusElement.textContent = getStatusIcon(message.status, true);
        
        // Adicionar atributo para estilização
        statusElement.setAttribute('data-status', message.status);
    }
}

function generateChatId(user1, user2) {
    return [user1, user2].sort().join('_');
}

function displayMessage(message) {
    const messagesContainer = document.getElementById('chatMessages');
    const isSent = message.sender === currentUser.id;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    messageDiv.id = `message-${message.messageId || message.key}`;
    
    const statusIcon = getStatusIcon(message.status, isSent);
    const time = formatTime(message.timestamp);
    
    messageDiv.innerHTML = `
        ${!isSent ? `<div class="message-sender">${message.senderName || message.sender}</div>` : ''}
        <div class="message-content">
            <div class="message-text">${message.text}</div>
            <div class="message-footer">
                <span class="message-time">${time}</span>
                ${isSent ? `<span class="message-status">${statusIcon}</span>` : ''}
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    
    // Se é uma mensagem recebida, marcar como lida após um delay
    if (!isSent && message.status !== 'read') {
        setTimeout(() => {
            markMessagesAsRead();
        }, 1000);
    }
}

// Obter ícone do status
function getStatusIcon(status, isSent) {
    if (!isSent) return '';
    
    switch (status) {
        case 'sent':
            return '⏰'; // Relógio - pendente
        case 'delivered':
            return '✅'; // Check - entregue
        case 'read':
            return '👀'; // Olhos - visualizada
        default:
            return '⏰'; // Padrão
    }
}

function sendMessage() {
    if (!currentChat) return;
    
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text) return;

    const message = {
        text: text,
        sender: currentUser.id,
        senderName: currentUser.displayName,
        timestamp: Date.now(),
        chatId: generateChatId(currentUser.id, currentChat.id),
        status: 'sent', // 'sent', 'delivered', 'read'
        messageId: generateMessageId() // ID único para a mensagem
    };

    const chatId = generateChatId(currentUser.id, currentChat.id);
    
    console.log('📤 Enviando mensagem:', message);
    
    database.ref('chats/' + chatId + '/messages').push(message)
        .then((ref) => {
            input.value = '';
            console.log('✅ Mensagem enviada com sucesso!');
            
            // Atualizar status para "entregue" quando o destinatário estiver online
            updateMessageStatus(ref.key, chatId, 'delivered');
        })
        .catch(error => {
            console.error('❌ Erro ao enviar mensagem:', error);
            alert('Erro ao enviar mensagem. Tente novamente.');
        });
}

// Gerar ID único para mensagem
function generateMessageId() {
    return 'MSG_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages');
    setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);
}

// ========== INDICADOR "DIGITANDO..." ==========
let typingTimeout = null;

function setupTypingIndicator() {
    const messageInput = document.getElementById('messageInput');
    
    messageInput.addEventListener('input', function() {
        if (this.value.trim().length > 0) {
            startTyping();
        } else {
            stopTyping();
        }
    });
    
    messageInput.addEventListener('blur', stopTyping);
}

function startTyping() {
    if (!currentChat) return;
    
    const chatId = generateChatId(currentUser.id, currentChat.id);
    database.ref(`typing/${chatId}/${currentUser.id}`).set(true);
    
    // Limpar timeout anterior
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }
    
    // Parar de digitar após 3 segundos de inatividade
    typingTimeout = setTimeout(stopTyping, 3000);
}

function stopTyping() {
    if (!currentChat) return;
    
    const chatId = generateChatId(currentUser.id, currentChat.id);
    database.ref(`typing/${chatId}/${currentUser.id}`).remove();
    
    if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
    }
}

// Listener para indicador de typing do outro usuário
function setupTypingListener() {
    if (!currentChat) return;
    
    const chatId = generateChatId(currentUser.id, currentChat.id);
    const typingRef = database.ref(`typing/${chatId}`);
    
    typingRef.on('value', (snapshot) => {
        const typingData = snapshot.val();
        showTypingIndicator(typingData);
    });
}

function showTypingIndicator(typingData) {
    const typingIndicator = document.getElementById('typingIndicator');
    
    if (!typingData || !typingData[currentChat.id]) {
        if (typingIndicator) {
            typingIndicator.remove();
        }
        return;
    }
    
    if (!typingIndicator) {
        const messagesContainer = document.getElementById('chatMessages');
        const indicator = document.createElement('div');
        indicator.id = 'typingIndicator';
        indicator.className = 'typing-indicator';
        indicator.innerHTML = `
            <div class="typing-avatar">${currentChat.name.charAt(0).toUpperCase()}</div>
            <div class="typing-content">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <div class="typing-text">${currentChat.name} está digitando...</div>
            </div>
        `;
        messagesContainer.appendChild(indicator);
        scrollToBottom();
    }
}

// ========== STATUS E UTILITÁRIOS ==========
function updateUserStatus(isOnline) {
    if (currentUser) {
        database.ref('users/' + currentUser.id).update({
            isOnline: isOnline,
            lastSeen: Date.now()
        })
        .then(() => {
            console.log(`✅ Status atualizado: ${isOnline ? 'Online' : 'Offline'}`);
        })
        .catch(error => {
            console.error('❌ Erro ao atualizar status:', error);
        });
    }
}

function updateUsersStatus(snapshot) {
    if (snapshot.exists()) {
        const users = snapshot.val();
        let cacheUpdated = false;
        
        // Atualizar status no cache
        Object.keys(users).forEach(username => {
            if (friendsCache[username]) {
                friendsCache[username].isOnline = users[username].isOnline;
                friendsCache[username].lastSeen = users[username].lastSeen;
                cacheUpdated = true;
            }
        });
        
        // Se tiver um chat ativo, atualizar status
        if (currentChat && friendsCache[currentChat.id]) {
            const friend = friendsCache[currentChat.id];
            document.getElementById('activeChatStatus').textContent = friend.isOnline ? 'Online' : 'Offline';
            document.getElementById('activeChatStatus').className = `user-status ${friend.isOnline ? 'status-online' : 'status-offline'}`;
        }
        
        // Se a aba de amigos estiver ativa e o cache foi atualizado, rerenderizar
        if (cacheUpdated && document.querySelector('#friendsTab').classList.contains('active')) {
            renderFriendsFromCache();
        }
    }
}

function logout() {
    console.log('🚪 Fazendo logout...');
    updateUserStatus(false);
    sessionStorage.clear();
    window.location.href = 'index.html';
}

// ========== FUNÇÕES AUXILIARES ==========
function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatLastSeen(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `${minutes} min atrás`;
    if (hours < 24) return `${hours} h atrás`;
    return `${days} dias atrás`;
}

function showNotification(message, type = 'success') {
    // Implementação simples - pode ser melhorada com toasts
    console.log(`📢 ${type.toUpperCase()}: ${message}`);
    alert(message);
}

function closeModal() {
    document.getElementById('userProfileModal').style.display = 'none';
}

// ========== INICIALIZAÇÃO FINAL ==========
document.addEventListener('DOMContentLoaded', initChat);

// Atualizar status quando a página for fechada
window.addEventListener('beforeunload', function() {
    updateUserStatus(false);
});


// ========== FUNÇÃO DE DEBUG ==========
function debugFirebase() {
    console.log('=== DEBUG FIREBASE ===');
    
    // Verificar usuários
    database.ref('users').once('value').then(snapshot => {
        console.log('👥 USUÁRIOS:', snapshot.val());
    });
    
    // Verificar solicitações
    database.ref('friend_requests').once('value').then(snapshot => {
        console.log('📨 SOLICITAÇÕES:', snapshot.val());
    });
    
    // Verificar amizades
    database.ref('friendships').once('value').then(snapshot => {
        console.log('🤝 AMIZADES:', snapshot.val());
    });
}

// Adicione um botão de debug temporário no HTML ou use no console
// Função para debug da pesquisa
function debugSearch() {
    const searchTerm = document.getElementById('userSearch').value.trim().toLowerCase();
    console.log('🔍 Termo de busca:', searchTerm);
    
    database.ref('users').once('value')
        .then(snapshot => {
            console.log('👥 Todos os usuários no banco:');
            const users = snapshot.val();
            Object.keys(users).forEach(username => {
                const user = users[username];
                console.log(`- @${user.username} (${user.displayName})`);
            });
        });
}

// Função para debug da interface de solicitações
function debugSolicitacoes() {
    console.log('=== DEBUG SOLICITAÇÕES ===');
    
    // Verificar elementos da DOM
    const requestsTab = document.getElementById('requestsTab');
    const requestsList = document.getElementById('requestsList');
    const requestsBadge = document.getElementById('requestsBadge');
    
    console.log('📋 RequestsTab existe:', !!requestsTab);
    console.log('📋 RequestsList existe:', !!requestsList);
    console.log('📋 RequestsBadge existe:', !!requestsBadge);
    
    if (requestsList) {
        console.log('📋 Conteúdo de requestsList:', requestsList.innerHTML);
        console.log('📋 Número de filhos:', requestsList.children.length);
    }
    
    // Verificar dados no Firebase
    database.ref('friend_requests').once('value').then(snapshot => {
        console.log('📨 Solicitações no Firebase:', snapshot.val());
    });
    
    // Forçar atualização da lista
    loadFriendRequests();
}

// ========== RESPONSIVIDADE MOBILE ==========

// Detectar se é mobile
function isMobile() {
    return window.innerWidth <= 768;
}

// Toggle do menu mobile
function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobileOverlay');
    
    if (sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open');
        overlay.style.display = 'none';
        document.body.style.overflow = 'auto';
    } else {
        sidebar.classList.add('mobile-open');
        overlay.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

// Mostrar lista de amigos (voltar do chat)
function showFriendsList() {
    if (!isMobile()) return;
    
    // Esconder header do chat
    document.getElementById('noChatSelected').style.display = 'block';
    document.getElementById('activeChatHeader').style.display = 'none';
    document.getElementById('chatInput').style.display = 'none';
    
    // Mostrar botão de menu
    document.getElementById('mobileChatInfo').style.display = 'flex';
    document.getElementById('mobileBackBtn').style.display = 'none';
    
    // Limpar chat atual
    currentChat = null;
    
    // Limpar mensagens
    document.getElementById('chatMessages').innerHTML = `
        <div class="welcome-message">
            <p>Selecione uma conversa para começar</p>
        </div>
    `;
    
    // Fechar menu se estiver aberto
    toggleMobileMenu();
}

// Atualizar header mobile quando inicia um chat
function updateMobileHeader() {
    if (!isMobile() || !currentChat) return;
    
    const mobileChatAvatar = document.getElementById('mobileChatAvatar');
    const mobileChatName = document.getElementById('mobileChatName');
    const mobileChatStatus = document.getElementById('mobileChatStatus');
    const mobileBackBtn = document.getElementById('mobileBackBtn');
    const mobileChatInfo = document.getElementById('mobileChatInfo');
    
    if (mobileChatAvatar) mobileChatAvatar.textContent = currentChat.name.charAt(0).toUpperCase();
    if (mobileChatName) mobileChatName.textContent = currentChat.name;
    if (mobileChatStatus) {
        const friend = friendsCache[currentChat.id];
        mobileChatStatus.textContent = friend && friend.isOnline ? 'Online' : 'Offline';
        mobileChatStatus.className = `mobile-user-status ${friend && friend.isOnline ? 'status-online' : 'status-offline'}`;
    }
    
    // Mostrar botão voltar e esconder info do chat
    mobileBackBtn.style.display = 'block';
    mobileChatInfo.style.display = 'none';
}

// Inicializar responsividade
function initResponsive() {
    const mobileHeader = document.getElementById('mobileHeader');
    
    if (isMobile()) {
        mobileHeader.style.display = 'flex';
        // Fechar menu mobile ao clicar em um amigo
        document.addEventListener('click', function(e) {
            if (e.target.closest('.user-item') && document.querySelector('.sidebar.mobile-open')) {
                toggleMobileMenu();
            }
        });
    } else {
        mobileHeader.style.display = 'none';
    }
    
    // Listeners para redimensionamento
    window.addEventListener('resize', function() {
        if (isMobile()) {
            mobileHeader.style.display = 'flex';
        } else {
            mobileHeader.style.display = 'none';
            // Garantir que sidebar esteja visível em desktop
            document.querySelector('.sidebar').classList.remove('mobile-open');
            document.getElementById('mobileOverlay').style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
}

// Atualizar a função startChat para mobile
function startChat(username, displayName) {
    console.log('💬 Iniciando chat com:', displayName, username);
    
    currentChat = {
        id: username,
        name: displayName
    };

    // Atualizar interface
    document.getElementById('noChatSelected').style.display = 'none';
    document.getElementById('activeChatHeader').style.display = 'flex';
    document.getElementById('activeChatName').textContent = displayName;
    document.getElementById('activeChatAvatar').textContent = displayName.charAt(0).toUpperCase();
    
    // Atualizar status
    const friend = friendsCache[username];
    document.getElementById('activeChatStatus').textContent = friend && friend.isOnline ? 'Online' : 'Offline';
    document.getElementById('activeChatStatus').className = `user-status ${friend && friend.isOnline ? 'status-online' : 'status-offline'}`;
    
    // Mostrar área de input
    document.getElementById('chatInput').style.display = 'flex';
    
    // Atualizar header mobile
    updateMobileHeader();
    
    // Carregar mensagens
    loadChatMessages();
    
    // Configurar listener de typing para este chat
    setupTypingListener();
    
    // Focar no input
    document.getElementById('messageInput').focus();
}

// ========== LIMPEZA AUTOMÁTICA POR ESPAÇO ==========

let monitoramentoAtivo = false;
const LIMITE_SEGURO = 900; // 900 MB (90% de 1GB)
const LIMITE_CRITICO = 950; // 950 MB (95% de 1GB)

function configurarMonitoramentoEspaco() {
    console.log('📊 Configurando monitoramento automático de espaço...');
    
    if (monitoramentoAtivo) return;
    monitoramentoAtivo = true;
    
    // Verificar espaço a cada 2 horas
    setInterval(() => {
        verificarEspacoEAjustar();
    }, 2 * 60 * 60 * 1000); // 2 horas
    
    // Verificar também na inicialização
    setTimeout(() => {
        verificarEspacoEAjustar();
    }, 15000); // 15 segundos após iniciar
    
    console.log('✅ Monitoramento automático ativado!');
}

function verificarEspacoEAjustar() {
    console.log('🔍 Verificando espaço usado...');
    
    // Verificar apenas os dados que temos permissão para acessar
    Promise.all([
        database.ref('users').once('value'),
        database.ref('chats').once('value'),
        database.ref('friend_requests').once('value'),
        database.ref('friendships').once('value')
    ])
    .then(([usersSnapshot, chatsSnapshot, requestsSnapshot, friendshipsSnapshot]) => {
        let totalSize = 0;
        
        // Calcular tamanho aproximado de cada parte
        if (usersSnapshot.exists()) {
            totalSize += new Blob([JSON.stringify(usersSnapshot.val())]).size;
        }
        if (chatsSnapshot.exists()) {
            totalSize += new Blob([JSON.stringify(chatsSnapshot.val())]).size;
        }
        if (requestsSnapshot.exists()) {
            totalSize += new Blob([JSON.stringify(requestsSnapshot.val())]).size;
        }
        if (friendshipsSnapshot.exists()) {
            totalSize += new Blob([JSON.stringify(friendshipsSnapshot.val())]).size;
        }
        
        const tamanhoMB = totalSize / 1024 / 1024;
        console.log(`📈 Espaço usado: ${tamanhoMB.toFixed(2)} MB`);
        
        atualizarPainelEspaco(tamanhoMB);
        
        // Verificar limites
        if (tamanhoMB >= LIMITE_CRITICO) {
            console.warn('🚨 LIMITE CRÍTICO! Iniciando limpeza URGENTE...');
            executarLimpezaUrgente();
        } else if (tamanhoMB >= LIMITE_SEGURO) {
            console.warn('⚠️  Limite seguro atingido! Iniciando limpeza preventiva...');
            executarLimpezaPreventiva();
        } else {
            console.log(`✅ Espaço dentro do limite. Livre: ${(1024 - tamanhoMB).toFixed(2)} MB`);
        }
    })
    .catch(error => {
        console.error('❌ Erro ao verificar espaço:', error);
        // Não mostrar erro para o usuário, apenas log
    });
}

function executarLimpezaUrgente() {
    console.log('🔥 LIMPEZA URGENTE: Espaço crítico detectado!');
    
    // Estratégia agressiva para liberar espaço rápido
    const estrategias = [
        () => limparMensagensAntigas(30),   // Mensagens com +30 dias
        () => limparMensagensAntigas(60),   // Mensagens com +60 dias  
        () => limparPorQuantidade(50),      // Manter só 50 msg/chat
        () => limparMensagensAntigas(7)     // Mensagens com +7 dias
    ];
    
    executarEstrategias(estrategias, 0);
}

function executarLimpezaPreventiva() {
    console.log('🛡️  LIMPEZA PREVENTIVA: Liberando espaço...');
    
    // Estratégia mais suave
    const estrategias = [
        () => limparMensagensAntigas(180),  // Mensagens com +180 dias
        () => limparPorQuantidade(100),     // Manter 100 msg/chat
        () => limparMensagensAntigas(90)    // Mensagens com +90 dias
    ];
    
    executarEstrategias(estrategias, 0);
}

function executarEstrategias(estrategias, index) {
    if (index >= estrategias.length) {
        console.log('✅ Todas as estratégias de limpeza concluídas');
        
        // Verificar espaço novamente após limpeza
        setTimeout(() => {
            verificarEspacoEAjustar();
        }, 10000);
        
        return;
    }
    
    console.log(`🔄 Executando estratégia ${index + 1}/${estrategias.length}...`);
    
    estrategias[index]()
        .then(() => {
            console.log(`✅ Estratégia ${index + 1} concluída`);
            
            // Próxima estratégia após 5 segundos
            setTimeout(() => {
                executarEstrategias(estrategias, index + 1);
            }, 5000);
        })
        .catch(error => {
            console.error(`❌ Erro na estratégia ${index + 1}:`, error);
            
            // Continuar com próxima estratégia mesmo com erro
            setTimeout(() => {
                executarEstrategias(estrategias, index + 1);
            }, 5000);
        });
}

// Versão atualizada das funções de limpeza que retornam Promise
function limparMensagensAntigas(dias) {
    return new Promise((resolve, reject) => {
        console.log(`🧹 Limpando mensagens com mais de ${dias} dias...`);
        
        const limiteTimestamp = Date.now() - (dias * 24 * 60 * 60 * 1000);
        let mensagensApagadas = 0;
        
        database.ref('chats').once('value')
            .then(snapshot => {
                if (!snapshot.exists()) {
                    console.log('📭 Nenhuma mensagem para limpar');
                    resolve();
                    return;
                }
                
                const updates = {};
                const chats = snapshot.val();
                
                Object.keys(chats).forEach(chatId => {
                    const messages = chats[chatId].messages;
                    
                    if (messages) {
                        Object.keys(messages).forEach(messageId => {
                            const message = messages[messageId];
                            
                            if (message.timestamp && message.timestamp < limiteTimestamp) {
                                updates[`chats/${chatId}/messages/${messageId}`] = null;
                                mensagensApagadas++;
                            }
                        });
                    }
                });
                
                if (mensagensApagadas > 0) {
                    console.log(`🗑️ ${mensagensApagadas} mensagens marcadas para limpeza`);
                    return database.ref().update(updates);
                } else {
                    console.log('📭 Nenhuma mensagem antiga encontrada');
                    resolve();
                }
            })
            .then(() => {
                console.log(`✅ Limpeza de ${dias} dias concluída: ${mensagensApagadas} mensagens`);
                resolve();
            })
            .catch(error => {
                console.error('❌ Erro na limpeza:', error);
                reject(error);
            });
    });
}

function limparPorQuantidade(limite) {
    return new Promise((resolve, reject) => {
        console.log(`🧹 Limitando para ${limite} mensagens por chat...`);
        
        database.ref('chats').once('value')
            .then(snapshot => {
                if (!snapshot.exists()) {
                    resolve();
                    return;
                }
                
                const updates = {};
                const chats = snapshot.val();
                let totalApagadas = 0;
                
                Object.keys(chats).forEach(chatId => {
                    const messages = chats[chatId].messages;
                    
                    if (messages && Object.keys(messages).length > limite) {
                        const messagesArray = Object.keys(messages).map(key => ({
                            key,
                            ...messages[key]
                        }));
                        
                        messagesArray.sort((a, b) => a.timestamp - b.timestamp);
                        const mensagensParaApagar = messagesArray.slice(0, -limite);
                        
                        mensagensParaApagar.forEach(msg => {
                            updates[`chats/${chatId}/messages/${msg.key}`] = null;
                            totalApagadas++;
                        });
                    }
                });
                
                if (totalApagadas > 0) {
                    console.log(`🗑️ ${totalApagadas} mensagens excedentes marcadas`);
                    return database.ref().update(updates);
                } else {
                    console.log('📭 Nenhuma mensagem excedente encontrada');
                    resolve();
                }
            })
            .then(() => {
                console.log(`✅ Limite de ${limite} mensagens aplicado`);
                resolve();
            })
            .catch(error => {
                console.error('❌ Erro ao limitar mensagens:', error);
                reject(error);
            });
    });
}

function atualizarPainelEspaco(tamanhoMB) {
    const spaceStatus = document.getElementById('spaceStatus');
    const spaceFill = document.getElementById('spaceFill');
    const spaceText = document.getElementById('spaceText');
    
    if (!spaceStatus) return;
    
    spaceStatus.style.display = 'block';
    
    const percentual = (tamanhoMB / 1024) * 100;
    
    // Atualizar barra de progresso
    spaceFill.style.width = `${percentual}%`;
    
    // Mudar cor baseada no uso
    if (percentual >= 95) {
        spaceFill.style.background = '#e53e3e';
    } else if (percentual >= 85) {
        spaceFill.style.background = '#ed8936'; 
    } else {
        spaceFill.style.background = '#48bb78';
    }
    
    // Atualizar texto
    spaceText.textContent = `${tamanhoMB.toFixed(1)}MB / 1024MB (${percentual.toFixed(1)}%)`;
}

function forcarAtualizacaoAmigos() {
    console.log('🔄 Forçando atualização da lista de amigos...');
    
    // Limpar cache
    friendsCache = {};
    friendsListLoaded = false;
    
    // Recarregar lista
    loadFriendsList();
    
    // Mostrar feedback
    showNotification('Lista de amigos atualizada!');
}

// Adicione um botão de atualização temporário (remova depois)
function adicionarBotaoAtualizacao() {
    const friendsTab = document.getElementById('friendsTab');
    if (!friendsTab) return;
    
    const botaoAtualizacao = document.createElement('button');
    botaoAtualizacao.textContent = '🔄 Atualizar Lista';
    botaoAtualizacao.className = 'btn-small btn-primary';
    botaoAtualizacao.style.margin = '10px';
    botaoAtualizacao.onclick = forcarAtualizacaoAmigos;
    
    friendsTab.insertBefore(botaoAtualizacao, friendsTab.firstChild);
}

function debugAmizades() {
    console.log('=== DEBUG AMIZADES ===');
    console.log('👤 Usuário atual:', currentUser.id);
    
    database.ref('friendships').once('value')
        .then(snapshot => {
            if (!snapshot.exists()) {
                console.log('❌ NÃO EXISTEM AMIZADES NO BANCO');
                return;
            }
            
            const friendships = snapshot.val();
            console.log('🤝 TODAS as amizades:', friendships);
            
            // Filtrar só as do usuário atual
            const minhasAmizades = [];
            Object.keys(friendships).forEach(id => {
                const f = friendships[id];
                if ((f.user1 === currentUser.id || f.user2 === currentUser.id) && f.status === 'accepted') {
                    minhasAmizades.push(f);
                }
            });
            
            console.log(`⭐ MINHAS AMIZADES (${minhasAmizades.length}):`, minhasAmizades);
            
            if (minhasAmizades.length === 0) {
                console.log('❌ Nenhuma amizade encontrada para o usuário atual');
            }
        });
}
