# Decisões

Sete decisões que moldaram a Zoka. Cada registro traz o contexto, a escolha, as alternativas que estavam na mesa e as consequências que vieram depois.

---

## ADR-001: Um runtime Next.js só, em vez de um serviço de API separado

**Contexto.** O produto precisava de páginas públicas renderizadas no servidor, telas autenticadas da aplicação e uma API para o cliente. Serviço de API separado significaria dois deployables, dois caminhos de autenticação e um salto de rede em cada render autenticado.

**Decisão.** Uma única aplicação Next.js hospeda páginas, route handlers e handlers de background. Server components leem dados direto pela camada de serviço; o browser só fala com route handlers.

**Alternativas.** Uma API NestJS ou Fastify atrás do front end; uma função serverless por endpoint.

**Consequências.** Um deploy, um caminho de autorização, nenhum DTO duplicado. O custo é que trabalho de longa duração divide o processo com o tráfego de requisições, então tudo que é pesado precisa de limite ou de agendamento. Uma separação futura é possível na camada de serviço, que já está isolada do transporte.

---

## ADR-002: Firebase para identidade e persistência, com as rules como segunda fronteira

**Contexto.** O time é pequeno, o público é regional, e o produto precisa de autenticação gerenciada com e-mail, CPF e Google, além de persistência de documentos isolada por tenant.

**Decisão.** Firebase Auth para identidade e Firestore em uma região de São Paulo para persistência. O browser nunca consulta o Firestore: todo acesso passa por route handlers. As security rules ficam ligadas e fechadas por padrão, repetindo as checagens do servidor.

**Alternativas.** PostgreSQL com ORM e uma stack de autenticação própria; um document store sem autenticação gerenciada.

**Consequências.** Nenhuma operação de banco para administrar, dados residentes na região e providers de identidade resolvidos sem custo extra. Firestore não é relacional, então os agregados são desnormalizados e os read models são mantidos na mão. Como o Admin SDK passa por cima das rules, elas são rede de segurança, não o controle principal, e as duas camadas precisam andar juntas.

---

## ADR-003: Troca do token do Firebase por um cookie de sessão HttpOnly

**Contexto.** Cliente Firebase normalmente guarda token no browser. Isso entrega credencial a qualquer script da página e deixa a revogação no servidor complicada.

**Decisão.** O servidor troca um ID token do Firebase já verificado por uma sessão opaca em cookie HttpOnly, Secure e SameSite. Custom claims carregam papel e plano como cache. Requisição que muda estado exige token CSRF.

**Alternativas.** ID token no cliente com refresh; uma biblioteca de sessão de terceiros.

**Consequências.** Script não consegue ler a sessão, e o logout revoga no servidor. A troca adiciona uma ida e volta no login e obriga o servidor a revalidar a sessão a cada requisição, que é o custo pretendido.

---

## ADR-004: Reserva e liquidação de cota, não um contador

**Contexto.** Tutoria tem custo marginal por geração. Contador incrementado antes da chamada ao provider cobra do usuário a falha; contador incrementado depois deixa requisição paralela estourar o limite.

**Decisão.** Reservar a vaga em uma transação antes de abrir o stream, e depois liquidar ou desfazer. A liquidação é idempotente, com chave por mensagem. Geração que falha devolve a cota diária, mas continua contando na janela horária de antiabuso.

**Alternativas.** Contagem otimista com reconciliação periódica; corte diário rígido, sem devolução.

**Consequências.** O resultado é correto sob concorrência e retry, ao preço de um estado de reserva de vida curta que precisa de tratamento de expiração. Uma varredura agendada libera as reservas órfãs.

---

## ADR-005: Entitlement derivado do estado da assinatura, claim só como cache

**Contexto.** No começo, a checagem de plano lia uma claim visível ao cliente, e um token desatualizado podia liberar recurso pago.

**Decisão.** Toda operação protegida resolve o entitlement no registro atual de assinatura ou concessão. As claims são sincronizadas depois, só para a UI. Quando as duas divergem, vale o registro.

**Alternativas.** Confiar nas claims e atualizar com agressividade; guardar uma flag de entitlement atualizada apenas por webhook.

**Consequências.** Uma claim desatualizada não escala acesso. O custo é uma leitura extra nos caminhos protegidos, atenuada por cache curto com chave por usuário e versão.

---

## ADR-006: Proxy de IA no servidor, com a escolha de provider na operação

**Contexto.** Vários providers foram avaliados. Fixar um deles acoplaria preço e confiabilidade a um fornecedor só, e chamar provider do browser exporia chaves.

**Decisão.** Toda inferência passa por um proxy que normaliza requisição, classifica intenção, aplica cota, entrega eventos tipados em streaming e mapeia falha de provider para uma taxonomia curta. A escolha de provider é configuração.

**Alternativas.** SDK do provider direto no browser com chave restrita; um gateway de IA gerenciado.

**Consequências.** A chave fica no servidor, a falha fica uniforme e o provider pode mudar sem tocar no cliente. O proxy vira ponto único de falha da tutoria, e a taxonomia de erros precisa acompanhar as mudanças de contrato dos providers.

---

## ADR-007: Analytics só com consentimento e minimização de dados por padrão

**Contexto.** O público inclui menores, e o produto precisa de dado de uso para melhorar. Analytics ligado por padrão coletaria mais do que o necessário e seria indefensável na conversa com um pai ou uma mãe.

**Decisão.** O analytics só é injetado depois de consentimento explícito, e recusar é um estado permanente válido. Page view usa título fixo e caminho anonimizado; query e identificador são removidos. Decisão de produto sai de contagem agregada, não de rastreamento por usuário.

**Alternativas.** Analytics ligado por padrão com opt-out; analytics no servidor, sem script no cliente.

**Consequências.** O dado de conversão fica incompleto por design, e alguns experimentos não podem ser medidos. Isso foi aceito: a alternativa é coletar dado de menor sem base defensável.
