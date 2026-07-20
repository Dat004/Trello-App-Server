const toPlain = (value) => {
  if (!value) return value;
  if (typeof value.toObject === "function") return value.toObject({ virtuals: true });
  return value;
};

const sanitizeUser = (user, { includeEmail = false } = {}) => {
  if (!user) return user;
  const plain = toPlain(user);
  const result = {
    _id: plain._id,
    full_name: plain.full_name,
    avatar: plain.avatar,
  };
  if (includeEmail && plain.email) {
    result.email = plain.email;
  }
  return result;
};

const sanitizeMemberEntry = (member, options) => {
  const plain = toPlain(member);
  return {
    ...plain,
    user: sanitizeUser(plain.user, options),
  };
};

const sanitizeJoinRequest = (request, { includeEmail = false } = {}) => {
  const plain = toPlain(request);
  return {
    ...plain,
    user: sanitizeUser(plain.user, { includeEmail }),
  };
};

/**
 * Project board payloads so public / read-only viewers do not receive
 * member emails, invites, or join-request queues.
 */
const projectBoardForViewer = (
  board,
  { includeEmails = false, includeAdminFields = false } = {}
) => {
  const projected = { ...toPlain(board) };

  if (Array.isArray(projected.members)) {
    projected.members = projected.members.map((member) =>
      sanitizeMemberEntry(member, { includeEmail: includeEmails })
    );
  }

  if (!includeAdminFields) {
    delete projected.invites;
    delete projected.join_requests;
  } else if (Array.isArray(projected.join_requests)) {
    projected.join_requests = projected.join_requests.map((request) =>
      sanitizeJoinRequest(request, { includeEmail: true })
    );
  }

  if (Array.isArray(projected.lists)) {
    projected.lists = projected.lists.map((list) => {
      const listPlain = toPlain(list);
      return {
        ...listPlain,
        cards: Array.isArray(listPlain.cards)
          ? listPlain.cards.map((card) => {
              const cardPlain = toPlain(card);
              return {
                ...cardPlain,
                members: Array.isArray(cardPlain.members)
                  ? cardPlain.members.map((user) =>
                      sanitizeUser(user, { includeEmail: includeEmails })
                    )
                  : cardPlain.members,
              };
            })
          : listPlain.cards,
      };
    });
  }

  return projected;
};

/**
 * Project workspace payloads for guests and non-admin members.
 */
const projectWorkspaceForViewer = (
  workspace,
  { includeEmails = false, includeAdminFields = false } = {}
) => {
  const projected = { ...toPlain(workspace) };

  if (projected.owner && typeof projected.owner === "object") {
    projected.owner = sanitizeUser(projected.owner, { includeEmail: includeEmails });
  }

  if (Array.isArray(projected.members)) {
    projected.members = projected.members.map((member) =>
      sanitizeMemberEntry(member, { includeEmail: includeEmails })
    );
  }

  if (!includeAdminFields) {
    delete projected.invites;
    delete projected.join_requests;
  } else if (Array.isArray(projected.join_requests)) {
    projected.join_requests = projected.join_requests.map((request) =>
      sanitizeJoinRequest(request, { includeEmail: true })
    );
  }

  return projected;
};

module.exports = {
  sanitizeUser,
  projectBoardForViewer,
  projectWorkspaceForViewer,
};
