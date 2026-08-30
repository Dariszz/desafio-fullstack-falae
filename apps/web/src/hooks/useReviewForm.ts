import { useCallback, useState } from 'react';
import { createReview, type CreateReviewInput } from '../api.js';
import { messageFrom, type NoticeMessage } from '../review-ui.js';

const EMPTY_FORM: CreateReviewInput = {
  external_id: '',
  company_id: '',
  rating: 5,
  comment: '',
};

export function useReviewForm(afterCreated: () => Promise<void>) {
  const [form, setForm] = useState<CreateReviewInput>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<NoticeMessage | null>(null);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setFormMessage(null);
    try {
      const response = await createReview({
        ...form,
        external_id: form.external_id.trim(),
        company_id: form.company_id.trim(),
        comment: form.comment.trim(),
      });
      setFormMessage({
        kind: 'success',
        text: response.duplicate
          ? 'Essa avaliação já existia e não foi processada novamente.'
          : 'Avaliação recebida. A análise continuará em segundo plano.',
      });
      setForm(EMPTY_FORM);
      await afterCreated();
    } catch (error) {
      setFormMessage({ kind: 'error', text: messageFrom(error) });
    } finally {
      setSubmitting(false);
    }
  }, [afterCreated, form]);

  return { form, setForm, submitting, formMessage, submit };
}
