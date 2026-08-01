  const revealEls = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target);} });
  },{threshold:0.15});
  revealEls.forEach(el=>io.observe(el));

  /* -------- AVALIAÇÕES -------- */
  // O window.storage só existe dentro do preview de Artifacts do Claude.
  // Se o site for aberto fora dali (arquivo local ou hospedado em outro servidor),
  // usamos um armazenamento apenas em memória para a sessão atual, e avisamos o usuário.
  let storageAvailable = (typeof window.storage !== 'undefined' && window.storage !== null);
  let memoryReviews = [];

  function starsString(n){
    let s='';
    for(let i=1;i<=5;i++){ s += i<=n ? '★' : '☆'; }
    return s;
  }
  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  function formatDate(iso){
    try{
      return new Date(iso).toLocaleDateString('pt-BR', {day:'2-digit', month:'short', year:'numeric'});
    }catch(e){ return ''; }
  }

  async function loadReviews(){
    if(!storageAvailable) return memoryReviews;
    try{
      const res = await window.storage.get('reviews', true);
      return res && res.value ? JSON.parse(res.value) : [];
    }catch(e){
      // Chave ainda não existe ou storage indisponível — trata como lista vazia
      return [];
    }
  }
  async function saveReviews(reviews){
    if(!storageAvailable){
      memoryReviews = reviews;
      return true;
    }
    try{
      const result = await window.storage.set('reviews', JSON.stringify(reviews), true);
      if(!result) throw new Error('Resposta vazia do storage');
      return true;
    }catch(e){
      console.error('Erro ao salvar avaliação:', e);
      // Se o storage falhar de vez, cai para o modo em memória a partir de agora
      storageAvailable = false;
      memoryReviews = reviews;
      showStorageNotice();
      return true;
    }
  }

  function showStorageNotice(){
    const existing = document.getElementById('storageNotice');
    if(existing) return;
    const notice = document.createElement('div');
    notice.id = 'storageNotice';
    notice.className = 'reviews-empty';
    notice.style.color = 'var(--brass-light)';
    notice.textContent = 'Aviso: este site está sendo aberto fora do preview do Claude, então as avaliações estão sendo salvas apenas temporariamente nesta sessão (serão perdidas ao recarregar a página).';
    document.querySelector('#avaliacoes .wrap').insertBefore(notice, document.getElementById('reviewsList'));
  }

  function renderReviews(reviews){
    const total = reviews.length;
    const avg = total ? reviews.reduce((a,r)=>a+r.rating,0)/total : 0;

    document.getElementById('mediaNota').textContent = total ? avg.toFixed(1) : '—';
    document.getElementById('mediaEstrelas').textContent = starsString(Math.round(avg));
    document.getElementById('totalAvaliacoes').textContent = total
      ? `${total} avaliaç${total>1?'ões':'ão'}`
      : 'Seja a primeira pessoa a avaliar';

    const list = document.getElementById('reviewsList');
    list.innerHTML = '';
    if(total === 0){
      list.innerHTML = '<div class="reviews-empty">Ainda não há avaliações. Seu comentário aparecerá aqui.</div>';
      return;
    }
    // guarda o índice original (no array não invertido) para excluir/responder corretamente
    const withIndex = reviews.map((r, i)=>({ r, i }));
    withIndex.slice().reverse().forEach(({r, i})=>{
      const card = document.createElement('div');
      card.className = 'review-card';
      card.dataset.index = i;
      card.innerHTML = `
        <div class="review-top">
          <span class="review-stars">${starsString(r.rating)}</span>
          <span class="review-name">${escapeHtml(r.name || 'Anônimo')}</span>
          <span class="review-date">${formatDate(r.date)}</span>
          <div class="review-owner-actions">
            <span class="action-link reply-toggle">Responder</span>
            <span class="action-link danger delete-review">Excluir</span>
          </div>
        </div>
        ${r.comment ? `<p class="review-comment">${escapeHtml(r.comment)}</p>` : ''}
        ${r.reply ? `
          <div class="owner-reply">
            <div class="reply-head">Resposta da Cantaria · ${formatDate(r.reply.date)}</div>
            <p>${escapeHtml(r.reply.text)}</p>
          </div>` : ''}
        <div class="reply-box">
          <textarea placeholder="Escreva a resposta pública a este comentário...">${r.reply ? escapeHtml(r.reply.text) : ''}</textarea>
          <button type="button" class="send-reply">${r.reply ? 'Atualizar resposta' : 'Publicar resposta'}</button>
        </div>
      `;
      list.appendChild(card);
    });
  }

  let currentRating = 0;
  const starInput = document.getElementById('starInput');
  const starSpans = starInput.querySelectorAll('span');
  function updateStars(hoverVal){
    const val = hoverVal || currentRating;
    starSpans.forEach(span=>{
      span.classList.toggle('active', parseInt(span.dataset.v) <= val);
    });
  }
  starSpans.forEach(span=>{
    span.addEventListener('click', ()=>{
      currentRating = parseInt(span.dataset.v);
      updateStars();
    });
    span.addEventListener('mouseenter', ()=> updateStars(parseInt(span.dataset.v)));
  });
  starInput.addEventListener('mouseleave', ()=> updateStars());

  const reviewForm = document.getElementById('reviewForm');
  reviewForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if(currentRating === 0){
      alert('Selecione uma nota de 1 a 5 estrelas antes de enviar.');
      return;
    }
    const btn = reviewForm.querySelector('.form-submit');
    const originalText = btn.textContent;
    btn.textContent = 'Enviando...';
    btn.disabled = true;

    const nome = document.getElementById('revNome').value.trim() || 'Anônimo';
    const comentario = document.getElementById('revComentario').value.trim();

    const reviews = await loadReviews();
    reviews.push({ name: nome, rating: currentRating, comment: comentario, date: new Date().toISOString() });
    const ok = await saveReviews(reviews);

    if(ok){
      renderReviews(reviews);
      reviewForm.reset();
      currentRating = 0;
      updateStars();
      btn.textContent = 'Avaliação enviada ✓';
    } else {
      btn.textContent = 'Erro, tente novamente';
    }
    setTimeout(()=>{ btn.textContent = originalText; btn.disabled = false; }, 2500);
  });


  const OWNER_PASSWORD_HASH = '6043958a9669318e740349f1d7f6a22f445ab3097cea82c2da5f236f04b619cc';

  async function sha256(text){
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  const ownerToggle = document.getElementById('ownerToggle');
  const ownerLogin = document.getElementById('ownerLogin');
  const ownerPasswordInput = document.getElementById('ownerPassword');
  const ownerLoginBtn = document.getElementById('ownerLoginBtn');
  const ownerBadge = document.getElementById('ownerBadge');

  ownerToggle.addEventListener('click', ()=>{
    ownerLogin.classList.toggle('open');
    if(ownerLogin.classList.contains('open')) ownerPasswordInput.focus();
  });

  async function tryOwnerLogin(){
    const hash = await sha256(ownerPasswordInput.value);
    if(hash === OWNER_PASSWORD_HASH){
      document.body.classList.add('is-owner');
      ownerBadge.style.display = 'inline-block';
      ownerPasswordInput.style.display = 'none';
      ownerLoginBtn.style.display = 'none';
      ownerToggle.textContent = 'Modo proprietário';
    } else {
      alert('Senha incorreta.');
    }
    ownerPasswordInput.value = '';
  }
  ownerLoginBtn.addEventListener('click', tryOwnerLogin);
  ownerPasswordInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); tryOwnerLogin(); } });

  // Delegação de eventos: excluir e responder avaliações (os cartões são recriados a cada render)
  const reviewsListEl = document.getElementById('reviewsList');
  reviewsListEl.addEventListener('click', async (e)=>{
    const card = e.target.closest('.review-card');
    if(!card) return;
    const idx = parseInt(card.dataset.index);

    if(e.target.classList.contains('delete-review')){
      if(!document.body.classList.contains('is-owner')) return;
      if(!confirm('Excluir esta avaliação? Essa ação não pode ser desfeita.')) return;
      const reviews = await loadReviews();
      reviews.splice(idx, 1);
      await saveReviews(reviews);
      renderReviews(reviews);
      return;
    }

    if(e.target.classList.contains('reply-toggle')){
      if(!document.body.classList.contains('is-owner')) return;
      card.querySelector('.reply-box').classList.toggle('open');
      return;
    }

    if(e.target.classList.contains('send-reply')){
      if(!document.body.classList.contains('is-owner')) return;
      const textarea = card.querySelector('.reply-box textarea');
      const text = textarea.value.trim();
      if(!text){ alert('Escreva uma resposta antes de publicar.'); return; }
      const reviews = await loadReviews();
      reviews[idx].reply = { text, date: new Date().toISOString() };
      await saveReviews(reviews);
      renderReviews(reviews);
    }
  });

  (async ()=>{
    if(!storageAvailable) showStorageNotice();
    const reviews = await loadReviews();
    renderReviews(reviews);
  })();  /* -------- FORMULÁRIO DE CONTATO -------- */
  // E-mail que recebe as solicitações de orçamento. Troque pelo e-mail real da empresa.
  const EMPRESA_EMAIL = 'contato@cantaria.com.br';

  const contatoForm = document.getElementById('contatoForm');
  contatoForm.addEventListener('submit', (e)=>{
    e.preventDefault();

    const nome = document.getElementById('contNome').value.trim();
    const telefone = document.getElementById('contTelefone').value.trim();
    const email = document.getElementById('contEmail').value.trim();
    const tipo = document.getElementById('contTipo').value;
    const mensagem = document.getElementById('contMensagem').value.trim();

    if(!nome || !telefone || !email || !tipo){
      alert('Preencha nome, telefone, e-mail e tipo de projeto antes de enviar.');
      return;
    }

    const assunto = `Solicitação de orçamento — ${tipo}`;
    const corpo =
`Nome: ${nome}
Telefone: ${telefone}
E-mail: ${email}
Tipo de projeto: ${tipo}

Mensagem:
${mensagem || '(não informado)'}`;

    const link = `mailto:${EMPRESA_EMAIL}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;

    const btn = contatoForm.querySelector('.form-submit');
    const hint = document.getElementById('contatoHint');
    window.location.href = link;

    btn.textContent = 'Abrindo seu app de e-mail...';
    hint.textContent = 'Se nada abrir, seu navegador pode não ter um app de e-mail padrão configurado — pode nos escrever direto para ' + EMPRESA_EMAIL + '.';
    setTimeout(()=>{ btn.textContent = 'Enviar solicitação'; }, 3500);
  });
