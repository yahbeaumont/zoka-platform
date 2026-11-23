# Estudo de caso: uma plataforma de estudos em que a IA precisa se pagar

## O ponto de partida

Zoka nasceu de uma observação simples: estudante brasileiro já estuda junto, mas as ferramentas que ele usa não foram feitas para estudar. Grupo de WhatsApp vira depósito de PDF e de pergunta sem resposta. Biblioteca de vídeo é passiva. Chatbot genérico responde com confiança e erra, sem contexto acadêmico e sem controle de custo.

O produto que eu queria era mais estreito que uma rede social e mais exigente que um chatbot: um lugar onde o estudante entra em um grupo, acha o canal da sua matéria e faz uma pergunta que volta com fontes, dentro de um plano que ele paga, sem a plataforma perder dinheiro a cada mensagem.

Três restrições definiram o trabalho. O público inclui menores, então o tratamento de dados precisava se sustentar antes de o primeiro usuário chegar. Inferência de IA tem custo marginal, então o modelo de negócio precisava estar no código, não em documento de política. E o time era um engenheiro só, o que significava que todo componente tinha de ser operável por uma pessoa às 2 da manhã.

## O que foi construído

A plataforma tem quatro camadas que precisavam concordar entre si.

**Identidade.** Login por e-mail, CPF e Google chegando a uma única conta, com uma sessão que o browser não consegue ler e papel e plano projetados como claims só para a interface.

**Comunidade.** Grupos com canais, mensagens diretas, aprovação de entrada, papéis de dono e moderador, um hub escolar derivado de domínio de e-mail e uma moderação que roda em fila, fora do caminho da requisição.

**Tutoria.** Um proxy que classifica intenção, decide se a pergunta precisa de busca na web, reserva cota, entrega a resposta em streaming, filtra prompt injection e sanitiza a saída.

**Comércio.** Assinaturas com período mensal e anual, plano família com dependentes e um fluxo de patrocínio separado que emite voucher resgatável em vez de inventar assinatura.

Cada camada é banal sozinha. A dificuldade morava nas emendas: cota e falha, identidade e vinculação, moderação e privacidade, entitlement e cache.

## As partes difíceis

### Uma cota que continua certa quando tudo dá errado

Minha primeira implementação incrementava um contador antes de chamar o provider. Em uma semana de uso real apareceram dois problemas. Um timeout do provider consumia a cota diária do estudante por uma resposta que nunca chegou. E duas abas enviando ao mesmo tempo passavam pela checagem, o que dava três respostas contra um limite de cinco.

O redesenho separou a decisão do efeito. Uma transação reserva a vaga e registra a tentativa. O stream abre. Se o primeiro token não vem, a reserva é desfeita e a cota diária volta, mas a tentativa continua contada na janela horária de antiabuso, porque ela custou alguma coisa. A liquidação tem chave por id de mensagem, então requisição repetida não liquida duas vezes.

A parte sutil é o órfão. Processo que morre entre a reserva e a liquidação deixa uma vaga presa sem dono. Uma varredura agendada libera as reservas vencidas. Contador simples nunca tem esse tipo de estado, e é esse o preço da correção.

### Vincular conta Google sem criar uma segunda pessoa

Em uma versão inicial, o fluxo do Google gerava conta duplicada. Quem se cadastrou por e-mail e depois clicou em "continuar com Google" terminava com dois perfis, dois planos e dois históricos, e o custo de suporte apareceu na hora.

A correção é um conflito deliberado. Quando a identidade Google verificada bate com um e-mail que já existe sob outro identificador, o servidor se recusa a fundir e devolve um conflito tipado. O cliente guarda a credencial OAuth pendente só em memória, pede a senha que já existe, autentica a pessoa, vincula a credencial àquele mesmo usuário e só então cria a sessão. Sem perfil duplicado, sem fusão silenciosa, sem revelar se o e-mail existe.

É mais lento para o usuário, e é o comportamento certo. Fusão automática é assim que uma plataforma perde conta.

### Moderação que respeita a sala

Sala de foco é sessão pequena de áudio e vídeo com um chat de texto ao lado. Ler cada mensagem em tempo real custa caro e, pior, é errado: estudante não deveria se sentir vigiado em uma sala de estudos.

O meio-termo foi analisar em lote. Dez mensagens entram na fila, são analisadas juntas, e só resultado positivo gera um alerta restrito com o trecho sinalizado. A interface do estudante nunca indica que houve análise. O painel da família mostra status agregado de segurança, nunca o texto.

Lote custa latência e a detecção deixa de ser imediata. Aceitei, porque a alternativa, um classificador em tempo real em cima de cada mensagem, transformaria o produto em algo que o estudante não usaria com honestidade.

### O bug que veio de um limite de provider que eu não tinha lido

O tier de criadores devolvia erro de servidor em toda requisição, enquanto o tier padrão funcionava. Nos logs, a rejeição do provider aparecia traduzida como erro de indisponibilidade. O payload parecia válido.

A causa era um limite documentado que eu supus em vez de conferir: o provider limita a saída em 1200 tokens e o payload do tier de criadores pedia 1800. O tier padrão pedia menos, e por isso só um caminho quebrava. A correção foi uma constante; a lição foi estrutural. Contrato de provider faz parte do sistema, e proxy que esconde o contrato esconde também a restrição. Desde então cada contrato é registrado com seus limites e coberto por um teste que falha quando o payload passa deles.

## O que mudou no caminho

A primeira versão confiava nas claims para checar plano. Durou até um token desatualizado liberar recurso pago pelo resto de uma sessão. O entitlement virou leitura derivada, com as claims rebaixadas a cache.

A primeira versão consultava o Firestore direto do browser para dado de comunidade. Era rápido de construir e impossível de manter seguro, porque cada tela nova precisava das suas próprias rules. Levar toda leitura para trás dos route handlers custou um salto de rede e comprou um caminho único de autorização.

A primeira versão modelava patrocínio como assinatura com desconto. Isso sujava o relatório de receita e a lógica de renovação. O voucher com concessão que expira e origem própria resolveu, ao custo de mais um conceito no domínio.

## O que eu faria diferente

Escreveria os testes de contrato de provider antes da primeira integração, não depois do incidente que os tornou necessários. Modelaria cota como agregado de primeira classe desde o início, em vez de pendurá-la em um contador. E decidiria o modelo de moderação antes de construir a sala, porque restrição de privacidade é barata de projetar e cara de adaptar depois.

## Onde está hoje

Zoka está em produção, com uma suíte de testes que roda contra emuladores e mocks, não contra dado de produção, e um modelo operacional que um engenheiro sustenta. A camada comercial, o modelo de dados e a configuração operacional não são publicados aqui. A abordagem de engenharia é.
