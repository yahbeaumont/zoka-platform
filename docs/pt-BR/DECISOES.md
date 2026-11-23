# Decisões

Sete decisões que moldaram a Zoka. Cada registro apresenta o contexto, a escolha, as alternativas consideradas e as consequências que vieram depois.

---

## ADR-001. Um único runtime Next.js em vez de um serviço de API separado

**Contexto.** O produto precisava de páginas públicas renderizadas no servidor, telas autenticadas da aplicação e uma API para o cliente. Um serviço de API separado significaria dois deployables, dois caminhos de autenticação e um salto de rede em cada render autenticado.

**Decisão.** Uma única aplicação Next.js hospeda páginas, route handlers e handlers de background. Server components leem dados diretamente pela camada de serviço; o browser fala apenas com route handlers.

**Alternativas.** Uma API NestJS ou Fastify atrás do front end; uma função serverless por endpoint.

**Consequências.** Um deploy, um caminho de autorização, nenhum DTO duplicado. O custo é que trabalho de longa duração compartilha um processo com o tráfego de requisições, então qualquer coisa pesada precisa ser limitada ou agendada. Uma separação futura é possível na camada de serviço, que já está isolada do transporte.

---

## ADR-002. Firebase para identidade e persistência, com as rules como segunda fronteira

**Contexto.** O time é pequeno, o público é regional e o produto precisa de autenticação gerenciada com e-mail, CPF e Google, além de persistência de documentos com isolamento por tenant.

**Decisão.** Firebase Auth para identidade e Firestore em uma região de São Paulo para persistência. O browser nunca consulta o Firestore diretamente; todo acesso passa por route handlers. As security rules continuam ativas e fechadas por padrão, duplicando as verificações do servidor.

**Alternativas.** PostgreSQL com um ORM e uma stack de autenticação própria; um document store sem autenticação gerenciada.

**Consequências.** Nenhuma operação de banco para administrar, residência regional dos dados e providers de identidade resolvidos sem custo adicional. O Firestore não é relacional, então os agregados são desnormalizados e os read models são mantidos explicitamente. Como o Admin SDK ignora as rules, as rules são uma rede de segurança, não o controle principal, e as duas camadas precisam ser mantidas consistentes.

---

## ADR-003. Trocar o token do Firebase por um cookie de sessão HttpOnly

**Contexto.** Clientes Firebase normalmente guardam tokens no browser. Isso expõe credenciais a qualquer script na página e torna a revogação no servidor complicada.

**Decisão.** O servidor troca um ID token do Firebase verificado por uma sessão opaca em um cookie HttpOnly, Secure e SameSite. Custom claims carregam papel e plano como cache. Tokens CSRF são exigidos em requisições que alteram estado.

**Alternativas.** ID tokens mantidos no cliente com refresh; uma biblioteca de sessão de terceiros.

**Consequências.** Scripts não conseguem ler a sessão, e o logout revoga no servidor. A troca adiciona uma ida e volta no login e exige que o servidor revalide a sessão em cada requisição, o que é o custo pretendido.

---

## ADR-004. Reserva e liquidação de cota em vez de um contador

**Contexto.** A tutoria tem custo marginal por geração. Um contador incrementado antes da chamada ao provider cobra do usuário pelas falhas; um contador incrementado depois permite que requisições paralelas gastem além do limite.

**Decisão.** Reservar uma vaga em uma transação antes de abrir o stream e depois liquidar ou desfazer. A liquidação é idempotente, com chave por mensagem. Gerações que falham restauram a cota diária, mas continuam contando na janela horária de antiabuso.

**Alternativas.** Contagem otimista com reconciliação periódica; corte diário rígido, sem devolução.

**Consequências.** Correto sob concorrência e retries, ao preço de um estado de reserva de curta duração que precisa de tratamento de expiração. Reservas órfãs são liberadas por uma varredura agendada.

---

## ADR-005. Entitlement derivado do estado da assinatura, com as claims apenas como cache

**Contexto.** As verificações de plano inicialmente liam de uma claim visível ao cliente, o que significava que um token desatualizado podia conceder recursos pagos.

**Decisão.** Toda operação protegida resolve o entitlement a partir do registro atual de assinatura ou concessão. As claims são sincronizadas depois, para fins de UI. Quando elas divergem, o registro vence.

**Alternativas.** Confiar nas claims e atualizar de forma agressiva; guardar uma flag de entitlement atualizada apenas por webhook.

**Consequências.** Uma claim desatualizada não consegue escalar acesso. O custo é uma leitura extra nos caminhos protegidos, mitigada por cache de curta duração com chave por usuário e versão.

---

## ADR-006. Um proxy de IA no servidor, com a escolha de provider mantida no nível operacional

**Contexto.** Vários providers foram avaliados. Fixar um deles acoplaria preço e confiabilidade a um único fornecedor, e chamar providers do browser exporia chaves.

**Decisão.** Toda inferência passa por um proxy que normaliza requisições, classifica intenção, aplica cotas, faz streaming de eventos tipados e mapeia falhas de provider para uma taxonomia pequena. A seleção de provider é configuração.

**Alternativas.** SDK do provider direto no browser com chaves restritas; um gateway de IA gerenciado.

**Consequências.** As chaves ficam no servidor, as falhas são uniformes e os providers podem mudar sem tocar no cliente. O proxy se torna um ponto único de falha para a tutoria, e sua taxonomia de erros precisa ser mantida conforme os providers mudam seus contratos.

---

## ADR-007. Analytics condicionado a consentimento e minimização de dados por padrão

**Contexto.** O público inclui menores, e o produto precisa de dados de uso para melhorar. Analytics por padrão coletaria mais do que o necessário e seria indefensável em uma conversa com um pai ou uma mãe.

**Decisão.** O analytics é injetado apenas após consentimento explícito, e a recusa é um estado permanente válido. Page views usam um título fixo e caminho anonimizado; queries e identificadores são removidos. Decisões de produto são tomadas a partir de contagens agregadas, não de rastreamento por usuário.

**Alternativas.** Analytics ligado por padrão com opt-out; analytics no servidor, sem script no cliente.

**Consequências.** Os dados de conversão são incompletos por design, e alguns experimentos não podem ser medidos. Isso foi aceito: a alternativa é coletar dados de menores sem uma base defensável.
