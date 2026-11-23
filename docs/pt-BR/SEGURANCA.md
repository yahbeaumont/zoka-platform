# Modelo de segurança e privacidade

Este documento descreve a postura de segurança da Zoka no nível de design. Ele omite intencionalmente detalhes relevantes para exploração, endpoints internos e configuração.

## 1. O que está sendo protegido

| Ativo | Por que importa |
|---|---|
| Identidade e dados de contato do estudante | O público inclui menores; a exposição tem consequências legais e pessoais |
| Conteúdo privado das comunidades | Mensagens, mensagens diretas e material de estudo pertencem aos seus autores |
| Estado de pagamento e entitlement | Impacto financeiro direto e superfície de fraude |
| Credenciais de provider de IA | O abuso seria cobrado da plataforma |
| Registros de moderação | Restritos; contêm trechos e identidades |

## 2. Fronteiras de confiança

1. **Browser para aplicação.** Entrada não confiável, incluindo headers e cookies. Todo valor é validado no servidor.
2. **Aplicação para provider de identidade.** Um ID token do Firebase é verificado, nunca aceito como JSON decodificado.
3. **Aplicação para persistência.** O Admin SDK ignora as rules do Firestore, então a aplicação é a autoridade de autorização e as rules são uma segunda fronteira, independente.
4. **Aplicação para providers externos.** Somente saída, com credenciais guardadas em um secret store gerenciado e nunca enviadas ao cliente.
5. **Aplicação para provider de pagamento.** Webhooks de entrada não são confiáveis até a assinatura ser verificada sobre o corpo bruto.

## 3. Ameaças consideradas

- **Roubo de credenciais por injeção de script.** Mitigado por cookie de sessão HttpOnly, que impede scripts de ler a sessão, e por tokens CSRF em requisições que alteram estado.
- **Escalação de privilégio por tokens desatualizados.** Mitigado por derivar o entitlement do estado da assinatura em toda operação protegida e tratar as claims como cache.
- **Bypass de cota e abuso de custo.** Mitigado por reserva no servidor, janelas horárias por usuário e cotas diárias, todas avaliadas antes da chamada ao provider.
- **Prompt injection contra o tutor.** Mitigado por classificação de entrada, isolamento de instruções e sanitização de saída. O risco residual permanece e está documentado como tal.
- **Acesso a dados entre tenants.** Mitigado por resolver associação e papel na camada de serviço antes de qualquer leitura, e por rules fechadas por padrão.
- **Falsificação e replay de webhook.** Mitigado por verificação de assinatura sobre o corpo bruto, deduplicação de eventos e aplicação idempotente.
- **Tomada de conta por vinculação de identidade.** Mitigado por recusar fusões automáticas e exigir prova da credencial existente antes de vincular.
- **Dados sensíveis em logs.** Mitigado por registrar identificadores e códigos em vez de payloads, e por nunca registrar corpos de resposta de provider.

## 4. Controles implementados

**Sessão.** Cookie de sessão opaco, HttpOnly, Secure, SameSite. Revogação no servidor no logout. Token CSRF validado em mutações.

**Identidade.** Senhas tratadas pelo provider de identidade. CPF guardado apenas como hash com salt para verificação de igualdade e um HMAC para busca no servidor, com a chave do HMAC fora do cliente. E-mail verificado exigido antes das áreas protegidas.

**Autorização.** Toda rota protegida resolve ator, recurso e papel. As rules do Firestore duplicam a verificação. Operações administrativas exigem a claim de papel e uma nova verificação no servidor, não apenas um botão escondido.

**Pagamentos.** Checkout hospedado, então dados de cartão nunca chegam à plataforma. Preços são validados contra um catálogo no servidor antes de o entitlement ser concedido. Webhooks são verificados e deduplicados.

**IA.** Chaves de provider existem apenas no runtime do servidor. Requisições são normalizadas; respostas são sanitizadas; bloqueios de política são mapeados para um erro de cliente distinto, para que a interface preserve o rascunho e explique que a cota não foi consumida.

**Telemetria.** Analytics é injetado apenas após consentimento explícito, com caminhos anonimizados e sem identificadores. Métricas de produto são agregadas.

**Secrets.** Vinculados por referência a partir de um secret store gerenciado em runtime. Nenhum secret é commitado, registrado em log, retornado ao cliente ou escrito em relatório.

## 5. O que não é afirmado

Este repositório não declara conformidade legal, certificação, resultados de pentest ou segurança absoluta. O produto aplica minimização de dados, consentimento e moderação porque o público exige, mas a avaliação jurídica de base legal, consentimento parental e retenção está fora do código e fora deste documento. O tratamento de dados de menores é um requisito de produto, não um problema de compliance resolvido.

Os filtros do tutor reduzem o risco de prompt injection e de saída insegura. Eles não o eliminam, e o produto avisa os usuários para não compartilhar dados pessoais na conversa.

## 6. Como reportar

Problemas de segurança devem ser reportados em privado ao mantenedor, pelo contato no perfil do GitHub. Por favor, não abra uma issue pública para uma vulnerabilidade suspeita.
