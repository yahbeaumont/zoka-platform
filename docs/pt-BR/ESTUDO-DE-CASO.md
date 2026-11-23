# Estudo de caso: construir uma plataforma de estudos em que a IA precisa se pagar

## O ponto de partida

Zoka começou com uma observação simples: estudantes brasileiros já estudam juntos, mas as ferramentas que usam não foram feitas para estudar. Grupos de WhatsApp enchem de PDFs e perguntas sem resposta. Bibliotecas de vídeo são passivas. Chatbots genéricos respondem com confiança e errado, sem contexto acadêmico e sem controle de custo.

O produto que eu queria era mais estreito que uma rede social e mais exigente que um chatbot: um lugar onde o estudante entra em um grupo, encontra o canal da sua matéria e faz uma pergunta que recebe resposta com fontes, dentro de um plano que ele paga, sem a plataforma perder dinheiro a cada mensagem.

Três restrições definiram o trabalho. O público inclui menores, então o tratamento de dados precisava ser defensável antes de o primeiro usuário chegar. A inferência de IA tem custo marginal, então o modelo de negócio precisava ser aplicado no código, não em um documento de política. E o time era um engenheiro, o que significava que todo componente tinha de ser operável por uma pessoa às 2 da manhã.

## O que foi construído

A plataforma tem quatro camadas que precisavam concordar entre si.

**Identidade.** Login com e-mail, CPF e Google resolvendo para uma única conta, com uma sessão que o browser não consegue ler, e papel e plano projetados como claims apenas para a interface.

**Comunidade.** Grupos com canais, mensagens diretas, aprovação de entrada, papéis de dono e moderador, um hub escolar derivado de um domínio de e-mail e uma moderação que roda em fila, não no caminho da requisição.

**Tutoria.** Um proxy que classifica intenção, decide se a pergunta precisa de busca na web, reserva cota, faz streaming da resposta, filtra prompt injection e sanitiza a saída.

**Comércio.** Assinaturas com períodos mensal e anual, um plano família com dependentes e um fluxo separado de patrocínio que emite vouchers resgatáveis em vez de inventar assinaturas.

Cada camada é banal isolada. A dificuldade estava nas costuras: cota e falha, identidade e vinculação, moderação e privacidade, entitlement e cache.

## As partes difíceis

### Uma cota que continua correta quando tudo dá errado

Minha primeira implementação incrementava um contador antes de chamar o provider. Em uma semana de uso real, dois problemas apareceram. Um timeout do provider consumia a cota diária do estudante por uma resposta que ele nunca recebeu. E duas abas enviando ao mesmo tempo conseguiam passar pela verificação, produzindo três respostas contra um limite de cinco.

O redesenho separou a decisão do efeito. Uma transação reserva uma vaga e registra a tentativa. O stream abre. Se o primeiro token nunca chega, a reserva é desfeita e a cota diária é restaurada, enquanto a tentativa continua contada na janela horária de antiabuso, porque a tentativa custou alguma coisa. A liquidação tem chave por id de mensagem, então uma requisição repetida não consegue liquidar duas vezes.

A parte sutil é o órfão. Um processo que morre entre a reserva e a liquidação deixa uma vaga presa sem nada. Uma varredura agendada libera reservas expiradas. Esse é o tipo de estado que um contador simples nunca tem, e é o preço da correção.

### Vincular uma conta Google sem criar uma segunda pessoa

O fluxo do Google gerava contas duplicadas em uma versão inicial. Um estudante que se cadastrou com e-mail e depois clicou em "continuar com Google" acabava com dois perfis, dois planos e dois históricos, e o custo de suporte foi imediato.

A correção é um conflito deliberado. Quando a identidade Google verificada corresponde a um e-mail existente sob um identificador diferente, o servidor se recusa a fundir e retorna um conflito tipado. O cliente mantém a credencial OAuth pendente apenas em memória, pede a senha existente, autentica a pessoa, vincula a credencial a esse mesmo usuário e só então cria a sessão. Sem perfil duplicado, sem fusão silenciosa, sem revelar se o e-mail existe.

É mais lento para o usuário e é o comportamento correto. A fusão automática é como as plataformas perdem contas.

### Moderação que respeita a sala

Salas de foco são sessões pequenas de áudio e vídeo com um chat de texto ao lado. Ler cada mensagem em tempo real é caro e, mais importante, errado: estudantes não deveriam se sentir vigiados em uma sala de estudos.

O compromisso foi a análise em lotes. Dez mensagens entram na fila, são analisadas juntas, e apenas um resultado positivo cria um alerta restrito com o trecho sinalizado. A interface do estudante nunca sinaliza que a análise aconteceu. O painel da família mostra status agregado de segurança, nunca o texto das mensagens.

O lote custa latência e significa que a detecção não é imediata. Aceitei isso, porque a alternativa, um classificador em tempo real em cada mensagem, transformaria o produto em algo que os estudantes não usariam com honestidade.

### O bug que veio de um limite de provider que eu não tinha lido

O tier de criadores retornava erro de servidor em toda requisição, enquanto o tier padrão funcionava. Os logs mostravam uma rejeição do provider traduzida como erro de indisponibilidade. O payload parecia válido.

A causa era um limite documentado que eu supus em vez de verificar: o provider limita os tokens de saída em 1200, e o payload do tier de criadores pedia 1800. O tier padrão pedia menos, e é por isso que só um caminho falhava. A correção foi uma constante, mas a lição foi estrutural: contratos de provider fazem parte do sistema, e um proxy que os esconde também esconde suas restrições. Desde então, cada contrato de provider é registrado com seus limites e coberto por um teste que falha quando o payload os ultrapassa.

## O que mudou no caminho

A primeira versão confiava nas claims para verificar o plano. Isso durou até um token desatualizado conceder um recurso pago durante toda uma sessão. O entitlement passou a ser uma leitura derivada, com as claims rebaixadas a cache.

A primeira versão consultava o Firestore do browser para dados de comunidade. Era rápido de construir e impossível de manter seguro, porque cada nova tela precisava das suas próprias rules. Mover todas as leituras para trás dos route handlers custou um salto de rede e comprou um caminho único de autorização.

A primeira versão modelava patrocínio como uma assinatura com desconto. Isso poluía os relatórios de receita e a lógica de renovação. Vouchers com uma concessão que expira e origem distinta resolveram, ao custo de mais um conceito no domínio.

## O que eu faria diferente

Eu escreveria os testes de contrato de provider antes da primeira integração, não depois do incidente que os tornou necessários. Modelaria cotas como um agregado de primeira classe desde o início, em vez de adicioná-las a um contador. E decidiria o modelo de moderação antes de construir a sala, porque restrições de privacidade são baratas de projetar e caras de adaptar depois.

## Onde está hoje

Zoka está em produção, com uma suíte de testes que roda contra emuladores e mocks em vez de dados de produção, e um modelo operacional que um engenheiro consegue sustentar. A camada comercial, o modelo de dados e a configuração operacional não são publicados aqui. A abordagem de engenharia é.
