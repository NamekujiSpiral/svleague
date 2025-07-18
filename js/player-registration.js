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
