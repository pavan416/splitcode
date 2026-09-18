// ==========================================================
// SplitCode V9
// Project Home Screen
// ==========================================================

function ProjectHome({
  hasSavedProject,
  savedProjectInfo,
  onNewProject,
  onContinueProject,
  onImportFiles,
  onImportFolder,
  supportedAccept,
}) {
  return (
    <div className="projectHome">

      {/* HERO */}

      <section className="projectHomeHero">

        <div className="projectHomeEyebrow">
          AI CODE → REAL PROJECT
        </div>

        <h1>
          Turn AI-generated code into
          <span> real project files.</span>
        </h1>

        <p>
          Split messy generated code,
          organize files, repair broken
          references, preview the result
          and export a complete project.
        </p>

      </section>

      {/* ACTIONS */}

      <section className="projectHomeActions">

        {/* NEW PROJECT */}

        <button
          type="button"
          className="homeActionCard homeNewProject"
          onClick={onNewProject}
        >

          <div className="homeActionIcon">
            +
          </div>

          <div className="homeActionContent">

            <strong>
              New Project
            </strong>

            <span>
              Start with AI-generated code
            </span>

          </div>

          <div className="homeActionArrow">
            →
          </div>

        </button>

        {/* SECONDARY ACTIONS */}

        <div className="homeSecondaryActions">

          {/* IMPORT PROJECT */}

          <div className="homeActionCard homeImportCard">

            <div className="homeActionIcon">
              ◫
            </div>

            <div className="homeActionContent">

              <strong>
                Import Project
              </strong>

              <span>
                Open files or a local folder
              </span>

            </div>

            <div className="homeImportButtons">

              <label className="homeSmallButton">

                Import Files

                <input
                  type="file"
                  multiple
                  accept={supportedAccept}
                  onChange={onImportFiles}
                  hidden
                />

              </label>

              <label className="homeSmallButton homeSmallButtonPrimary">

                Import Folder

                <input
                  type="file"
                  multiple
                  webkitdirectory=""
                  directory=""
                  onChange={onImportFolder}
                  hidden
                />

              </label>

            </div>

          </div>

          {/* CONTINUE PROJECT */}

          <button
            type="button"
            className={`homeActionCard homeContinueCard ${
              !hasSavedProject
                ? "homeContinueDisabled"
                : ""
            }`}
            onClick={
              hasSavedProject
                ? onContinueProject
                : undefined
            }
            disabled={!hasSavedProject}
          >

            <div className="homeActionIcon">
              ↗
            </div>

            <div className="homeActionContent">

              <strong>
                Continue Project
              </strong>

              {hasSavedProject ? (
                <>

                  <span>
                    Continue your locally saved workspace
                  </span>

                  {savedProjectInfo && (

                    <div className="homeSavedInfo">

                      <span className="homeSavedDot">
                        ✓
                      </span>

                      <span>
                        {savedProjectInfo.fileCount}{" "}
                        {savedProjectInfo.fileCount === 1
                          ? "file"
                          : "files"}
                      </span>

                      {savedProjectInfo.savedAt && (
                        <span>
                          • Saved locally
                        </span>
                      )}

                    </div>

                  )}

                </>
              ) : (
                <span>
                  No locally saved project yet
                </span>
              )}

            </div>

            {hasSavedProject && (

              <div className="homeActionArrow">
                →
              </div>

            )}

          </button>

        </div>

      </section>

      {/* PRIVACY */}

      <section className="projectHomePrivacy">

        <div>
          <span>✓</span>
          Runs locally
        </div>

        <div>
          <span>✓</span>
          No account required
        </div>

        <div>
          <span>✓</span>
          Your code stays in your browser
        </div>

      </section>

    </div>
  );
}

export default ProjectHome;