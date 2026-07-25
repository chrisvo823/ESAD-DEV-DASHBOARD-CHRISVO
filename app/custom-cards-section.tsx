"use client";

import { useAdminAuthenticated } from "./admin-auth";
import {
  addCustomCard,
  removeCustomCard,
  useCustomCards,
} from "./custom-cards-store";
import { ProjectPanel } from "./project-panel";
import { customCardToProject } from "./custom-card-project";

export function CustomCardsSection() {
  const authenticated = useAdminAuthenticated();
  const cards = useCustomCards();

  return (
    <div className="custom-cards-region">
      {authenticated ? (
        <div className="custom-cards-toolbar">
          <button
            type="button"
            className="config-window-trigger"
            onClick={() => {
              addCustomCard();
            }}
          >
            Add Card
          </button>
        </div>
      ) : null}

      {cards.length > 0 ? (
        <section
          className="custom-systems-grid"
          aria-label="Additional project boards"
        >
          {cards.map((card, index) => {
            const project = customCardToProject(card);
            return (
              <div className="custom-card-slot" key={card.id}>
                {authenticated ? (
                  <div className="custom-card-actions">
                    <button
                      type="button"
                      className="custom-card-remove"
                      onClick={() => {
                        removeCustomCard(card.id);
                      }}
                    >
                      Remove Card
                    </button>
                  </div>
                ) : null}
                <ProjectPanel
                  project={project}
                  index={4 + index}
                  layout="custom"
                />
              </div>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
