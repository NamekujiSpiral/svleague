// HTML要素の取得
const registerButton = document.getElementById('registerButton');
const playerNameInput = document.getElementById('playerName');
const playerRankSelect = document.getElementById('playerRank');
const playerList = document.getElementById('playerList');

// 登録ボタンのクリックイベント
registerButton.addEventListener('click', () => {
    const playerName = playerNameInput.value;
    const playerRank = playerRankSelect.value;

    if (playerName.trim() !== '') {
        db.collection('players').add({
            name: playerName,
            rank: playerRank,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            console.log('プレイヤーを登録しました:', playerName, 'ランク:', playerRank);
            playerNameInput.value = '';
            playerRankSelect.value = 'None';
        }).catch((error) => {
            console.error('登録エラー:', error);
        });
    }
});

// Firestoreからプレイヤーをリアルタイムで取得して表示
db.collection('players').orderBy('timestamp', 'desc')
    .onSnapshot((snapshot) => {
        playerList.innerHTML = ''; // リストをクリア
        snapshot.forEach((doc) => {
            const player = doc.data();
            const li = createPlayerListItem(doc.id, player);
            playerList.appendChild(li);
        });
    });

// プレイヤーリストの各項目を生成する関数
function createPlayerListItem(id, player) {
    const li = document.createElement('li');
    li.setAttribute('data-id', id);

    // プレイヤー情報部分
    const infoDiv = document.createElement('div');
    infoDiv.classList.add('player-info');

    const rankSpan = document.createElement('span');
    rankSpan.textContent = `[${player.rank || 'None'}]`;
    rankSpan.classList.add('player-rank');

    const nameSpan = document.createElement('span');
    nameSpan.textContent = player.name;
    nameSpan.classList.add('player-name');

    infoDiv.appendChild(rankSpan);
    infoDiv.appendChild(nameSpan);

    // 操作ボタン部分
    const actionsDiv = document.createElement('div');
    actionsDiv.classList.add('player-actions');

    const editButton = document.createElement('button');
    editButton.textContent = '編集';
    editButton.classList.add('edit-btn', 'btn-small');
    editButton.setAttribute('data-action', 'edit');

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '削除';
    deleteButton.classList.add('delete-btn', 'btn-small');
    deleteButton.setAttribute('data-action', 'delete');

    actionsDiv.appendChild(editButton);
    actionsDiv.appendChild(deleteButton);

    li.appendChild(infoDiv);
    li.appendChild(actionsDiv);

    return li;
}

// プレイヤーリストのクリックイベント（イベント委任）
playerList.addEventListener('click', (e) => {
    const target = e.target;
    if (target.tagName !== 'BUTTON') return;

    const action = target.dataset.action;
    const li = target.closest('li');
    if (!li) return;

    const docId = li.dataset.id;

    if (action === 'delete') {
        handleDelete(docId);
    } else if (action === 'edit') {
        handleEdit(li);
    } else if (action === 'cancel') {
        handleCancel(li);
    } else if (action === 'update') {
        handleUpdate(li);
    }
});

// 削除処理
function handleDelete(docId) {
    if (window.confirm('このプレイヤーを削除しますか？')) {
        db.collection('players').doc(docId).delete()
            .then(() => console.log('プレイヤーを削除しました'))
            .catch(error => console.error('削除エラー:', error));
    }
}

// 編集モードへの切り替え
function handleEdit(li) {
    const infoDiv = li.querySelector('.player-info');
    const actionsDiv = li.querySelector('.player-actions');
    const currentName = infoDiv.querySelector('.player-name').textContent;
    const currentRank = infoDiv.querySelector('.player-rank').textContent.replace(/[\[\]]/g, '');

    // 元のデータをli要素に保存
    li.setAttribute('data-original-name', currentName);
    li.setAttribute('data-original-rank', currentRank);

    infoDiv.innerHTML = `
        <input type="text" class="edit-name-input" value="${currentName}">
        <select class="edit-rank-select">
            <option value="S" ${currentRank === 'S' ? 'selected' : ''}>S</option>
            <option value="A" ${currentRank === 'A' ? 'selected' : ''}>A</option>
            <option value="B" ${currentRank === 'B' ? 'selected' : ''}>B</option>
            <option value="C" ${currentRank === 'C' ? 'selected' : ''}>C</option>
            <option value="None" ${currentRank === 'None' || !currentRank ? 'selected' : ''}>ランクなし</option>
        </select>
    `;

    actionsDiv.innerHTML = `
        <button class="update-btn btn-small" data-action="update">更新</button>
        <button class="cancel-btn btn-small" data-action="cancel">キャンセル</button>
    `;
}

// 更新処理
function handleUpdate(li) {
    const docId = li.dataset.id;
    const newName = li.querySelector('.edit-name-input').value;
    const newRank = li.querySelector('.edit-rank-select').value;

    if (newName.trim() === '') {
        alert('プレイヤー名は空にできません。');
        return;
    }

    db.collection('players').doc(docId).update({
        name: newName,
        rank: newRank
    }).then(() => {
        console.log('プレイヤー情報を更新しました');
        // onSnapshotが自動でUIを更新します
    }).catch(error => {
        console.error('更新エラー:', error);
    });
}

// キャンセル処理
function handleCancel(li) {
    // FirestoreのonSnapshotが自動でリストを再描画するため、
    // 基本的には何もしなくても数秒で元に戻りますが、
    // ユーザー体験向上のため、即座に元の表示に戻します。
    const docId = li.dataset.id;
    const originalName = li.dataset.originalName;
    const originalRank = li.dataset.originalRank;
    const player = { name: originalName, rank: originalRank };
    
    const newLi = createPlayerListItem(docId, player);
    li.parentNode.replaceChild(newLi, li);
}

document.addEventListener('DOMContentLoaded', () => {
    // 認証状態表示とログアウトボタンの処理
    const authStatusDiv = document.getElementById('authStatus');
    const logoutButton = document.getElementById('logoutButton');

    // 管理者ログインフォーム関連の要素
    const adminLoginFormContainer = document.getElementById('adminLoginFormContainer');
    const showLoginButton = document.getElementById('showLoginButton');
    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginButton = document.getElementById('loginButton');
    const loginError = document.getElementById('loginError');

    // プレイヤー登録フォームのコンテナ
    const playerRegistrationFormContainer = document.getElementById('playerRegistrationFormContainer');

    // ハンバーガーメニュー関連の要素
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    const navLinks = document.getElementById('navLinks');

    // ログアウトボタンのクリックイベント
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            firebase.auth().signOut()
                .then(() => {
                    console.log("ログアウトしました。");
                    alert("ログアウトしました。");
                })
                .catch((error) => {
                    console.error("ログアウトエラー:", error.code, error.message);
                    alert("ログアウトエラー: " + error.message);
                });
        });
    }

    // 管理者ログインボタンのクリックイベント
    if (showLoginButton) {
        showLoginButton.addEventListener('click', () => {
            // フォームの表示/非表示を切り替える
            if (adminLoginFormContainer.style.display === 'none') {
                adminLoginFormContainer.style.display = 'block';
                loginError.textContent = ''; // エラーメッセージをクリア
            } else {
                adminLoginFormContainer.style.display = 'none';
            }
        });
    }

    // ログインボタンのクリックイベント
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            const email = loginEmailInput.value;
            const password = loginPasswordInput.value;

            loginError.textContent = ''; // エラーメッセージをクリア

            firebase.auth().signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    // ログイン成功
                    const user = userCredential.user;
                    console.log('ログイン成功！UID:', user.uid);
                    alert('ログイン成功！UID: ' + user.uid);
                    // ログイン成功後、フォームを非表示にする
                    adminLoginFormContainer.style.display = 'none';
                })
                .catch((error) => {
                    // ログイン失敗
                    console.error('ログインエラー:', error.code, error.message);
                    loginError.textContent = 'ログイン失敗: ' + error.message;
                });
        });
    }

    // ハンバーガーメニューのクリックイベント
    if (hamburgerMenu) {
        hamburgerMenu.addEventListener('click', () => {
            navLinks.classList.toggle('open');
            hamburgerMenu.classList.toggle('open');
        });
    }

    // 認証状態の変更を監視
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            // ログインしている場合
            authStatusDiv.textContent = `ログイン中: ${user.email || user.uid}`;
            logoutButton.style.display = 'inline-block'; // ボタンを表示
            if (showLoginButton) {
                showLoginButton.style.display = 'none'; // 管理者ログインボタンを非表示
            }
            if (adminLoginFormContainer) {
                adminLoginFormContainer.style.display = 'none'; // ログインフォームを非表示
            }

            // FirestoreからユーザーのisAdminステータスを確認
            db.collection('users').doc(user.uid).get()
                .then((doc) => {
                    if (doc.exists && doc.data().isAdmin) {
                        // 管理者の場合
                        document.body.classList.add('admin-logged-in');
                        if (playerRegistrationFormContainer) {
                            playerRegistrationFormContainer.style.display = 'block'; // 登録フォームを表示
                        }
                    } else {
                        // 管理者ではない場合
                        document.body.classList.remove('admin-logged-in');
                        if (playerRegistrationFormContainer) {
                            playerRegistrationFormContainer.style.display = 'none'; // 登録フォームを非表示
                        }
                    }
                })
                .catch((error) => {
                    console.error("isAdminステータス取得エラー:", error);
                    document.body.classList.remove('admin-logged-in'); // エラー時も非管理者として扱う
                    if (playerRegistrationFormContainer) {
                        playerRegistrationFormContainer.style.display = 'none'; // 登録フォームを非表示
                    }
                });

        } else {
            // ログアウトしている場合
            authStatusDiv.textContent = 'ログアウト中';
            logoutButton.style.display = 'none'; // ボタンを非表示
            if (showLoginButton) {
                showLoginButton.style.display = 'inline-block'; // 管理者ログインボタンを表示
            }
            document.body.classList.remove('admin-logged-in'); // 管理者クラスを削除
            if (playerRegistrationFormContainer) {
                playerRegistrationFormContainer.style.display = 'none'; // 登録フォームを非表示
            }
        }
    });
});