import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { retrospectiveService, templateService } from '../services/api';
import { TemplateType } from '../types';
import type { TemplateColumn, VotingConfig } from '../types';

export const CreateRetrospectivePage: React.FC = () => {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const [templateType, setTemplateType] = useState<TemplateType>(TemplateType.WENT_WELL_TO_IMPROVE);
  const [templateColumns, setTemplateColumns] = useState<TemplateColumn[]>([]);
  const [votingConfig, setVotingConfig] = useState<VotingConfig>({
    maxVotesPerUser: 5,
    allowMultipleVotesPerItem: false,
    anonymousVoting: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load template columns when template type changes
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const { template } = await templateService.getDefaultTemplate(templateType);
        setTemplateColumns(template.columns);
      } catch (err) {
        console.error('Failed to load template:', err);
      }
    };
    if (templateType !== TemplateType.CUSTOM) {
      loadTemplate();
    }
  }, [templateType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Read values directly from form elements
    const form = formRef.current;
    if (!form) return;

    const teamId = (form.elements.namedItem('teamId') as HTMLInputElement)?.value || '';
    const sprintName = (form.elements.namedItem('sprintName') as HTMLInputElement)?.value || '';
    const description = (form.elements.namedItem('description') as HTMLTextAreaElement)?.value || '';

    if (!teamId || !sprintName) {
      setError('Team and Sprint Name are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const { retrospectiveId } = await retrospectiveService.create({
        teamId,
        sprintName,
        description,
        templateType,
        votingConfig,
      });
      navigate(`/retros/${retrospectiveId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create retrospective');
    } finally {
      setIsSubmitting(false);
    }
  };

  const templates = [
    {
      type: TemplateType.WENT_WELL_TO_IMPROVE,
      name: 'What Went Well / To Improve',
      description: 'Classic format with positive and improvement areas',
      icon: '👍',
      columns: ['Went Well', 'To Improve', 'Action Items'],
    },
    {
      type: TemplateType.START_STOP_CONTINUE,
      name: 'Start / Stop / Continue',
      description: 'Focus on behavioral changes',
      icon: '🚦',
      columns: ['Start', 'Stop', 'Continue'],
    },
    {
      type: TemplateType.FOUR_LS,
      name: '4Ls',
      description: 'Liked, Learned, Lacked, Longed For',
      icon: '📚',
      columns: ['Liked', 'Learned', 'Lacked', 'Longed For'],
    },
    {
      type: TemplateType.MAD_SAD_GLAD,
      name: 'Mad / Sad / Glad',
      description: 'Emotional retrospective format',
      icon: '😊',
      columns: ['Mad', 'Sad', 'Glad'],
    },
  ];

  return (
    <div className="min-h-screen vendasta-gradient-subtle">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-sm border-b border-vendasta-900/50">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link to="/retros" className="text-slate-400 hover:text-vendasta-400 transition-colors text-sm mb-2 inline-block">
            ← Back to Retrospectives
          </Link>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span className="text-4xl">✨</span>
            New Retrospective
          </h1>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info */}
          <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-xl font-semibold text-white mb-6">Basic Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Team *
                </label>
                <input
                  type="text"
                  name="teamId"
                  placeholder="team-engineering"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-vendasta-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Team Display Name
                </label>
                <input
                  type="text"
                  name="teamName"
                  placeholder="Engineering Team"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-vendasta-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Sprint Name *
                </label>
                <input
                  type="text"
                  name="sprintName"
                  placeholder="Sprint 42"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-vendasta-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description (optional)
                </label>
                <textarea
                  name="description"
                  placeholder="What was the focus of this sprint?"
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-vendasta-500 resize-none"
                />
              </div>
            </div>
          </section>

          {/* Template Selection */}
          <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-xl font-semibold text-white mb-6">Choose a Template</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => (
                <motion.button
                  key={template.type}
                  type="button"
                  onClick={() => setTemplateType(template.type)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={clsx(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    templateType === template.type
                      ? 'border-vendasta-500 bg-vendasta-500/10'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{template.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{template.name}</h3>
                      <p className="text-sm text-slate-400 mt-1">{template.description}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {template.columns.map((col) => (
                          <span
                            key={col}
                            className="px-2 py-0.5 bg-slate-700/50 rounded text-xs text-slate-300"
                          >
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>
                    {templateType === template.type && (
                      <span className="text-vendasta-400 text-xl">✓</span>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </section>

          {/* Voting Configuration */}
          <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-xl font-semibold text-white mb-6">Voting Settings</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Votes per person
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={votingConfig.maxVotesPerUser}
                    onChange={(e) =>
                      setVotingConfig({ ...votingConfig, maxVotesPerUser: Number(e.target.value) })
                    }
                    className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-vendasta-500"
                  />
                  <span className="text-2xl font-bold text-white w-12 text-center">
                    {votingConfig.maxVotesPerUser}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between py-3 border-t border-slate-700">
                <div>
                  <p className="text-white font-medium">Allow multiple votes per item</p>
                  <p className="text-sm text-slate-400">Users can vote for the same item multiple times</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setVotingConfig({
                      ...votingConfig,
                      allowMultipleVotesPerItem: !votingConfig.allowMultipleVotesPerItem,
                    })
                  }
                  className={clsx(
                    'w-12 h-6 rounded-full transition-colors relative',
                    votingConfig.allowMultipleVotesPerItem ? 'bg-vendasta-500' : 'bg-slate-600'
                  )}
                >
                  <span
                    className={clsx(
                      'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                      votingConfig.allowMultipleVotesPerItem ? 'translate-x-7' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-3 border-t border-slate-700">
                <div>
                  <p className="text-white font-medium">Anonymous voting</p>
                  <p className="text-sm text-slate-400">Hide who voted for which items</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setVotingConfig({
                      ...votingConfig,
                      anonymousVoting: !votingConfig.anonymousVoting,
                    })
                  }
                  className={clsx(
                    'w-12 h-6 rounded-full transition-colors relative',
                    votingConfig.anonymousVoting ? 'bg-vendasta-500' : 'bg-slate-600'
                  )}
                >
                  <span
                    className={clsx(
                      'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                      votingConfig.anonymousVoting ? 'translate-x-7' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Error */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-400">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-end gap-4">
            <Link
              to="/retros"
              className="px-6 py-3 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 bg-vendasta-500 text-white rounded-xl hover:bg-vendasta-400 transition-all font-medium shadow-lg shadow-vendasta-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Retrospective'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default CreateRetrospectivePage;
