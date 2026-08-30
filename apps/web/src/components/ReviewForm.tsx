import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { CreateReviewInput } from '../api.js';
import type { NoticeMessage } from '../review-ui.js';
import { Notice } from './Notice.js';

interface ReviewFormProps {
  form: CreateReviewInput;
  setForm: Dispatch<SetStateAction<CreateReviewInput>>;
  submitting: boolean;
  formMessage: NoticeMessage | null;
  submit: () => Promise<void>;
}

export function ReviewForm({
  form,
  setForm,
  submitting,
  formMessage,
  submit,
}: ReviewFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  return (
    <article className="panel form-panel">
      <div className="section-heading">
        <p className="step">01 · Nova avaliação</p>
        <h2>O que o cliente contou?</h2>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="field-row">
          <label>
            ID da avaliação
            <input
              name="external_id"
              value={form.external_id}
              onChange={(event) =>
                setForm({ ...form, external_id: event.target.value })
              }
              placeholder="review-order-123"
              maxLength={100}
              required
            />
          </label>
          <label>
            ID da empresa
            <input
              name="company_id"
              value={form.company_id}
              onChange={(event) =>
                setForm({ ...form, company_id: event.target.value })
              }
              placeholder="company-456"
              maxLength={100}
              required
            />
          </label>
        </div>
        <fieldset>
          <legend>Nota</legend>
          <div className="rating-options">
            {[1, 2, 3, 4, 5].map((rating) => (
              <label key={rating}>
                <input
                  type="radio"
                  name="rating"
                  value={rating}
                  checked={form.rating === rating}
                  onChange={() => setForm({ ...form, rating })}
                />
                <span>{rating}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          Comentário
          <textarea
            name="comment"
            value={form.comment}
            onChange={(event) =>
              setForm({ ...form, comment: event.target.value })
            }
            placeholder="Conte como foi a experiência do cliente..."
            minLength={3}
            maxLength={2000}
            rows={5}
            required
          />
          <span className="character-count">{form.comment.length}/2000</span>
        </label>
        {formMessage && <Notice message={formMessage} />}
        <button className="primary-button" disabled={submitting}>
          {submitting ? 'Enviando…' : 'Enviar para análise'}
        </button>
      </form>
    </article>
  );
}
