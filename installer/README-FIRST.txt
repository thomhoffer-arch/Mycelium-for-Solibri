Mycelium for Solibri — quick start
==================================

This app reads issues and checking/QA data from Solibri Desktop's REST API and
emits Connective Spine records (a normalized JSON feed) for Mycelium Studio.

BEFORE YOU START
----------------
Launch Solibri Desktop with the REST API enabled. It then serves the API at:
    http://localhost:10876/solibri/v1/
(Confirm the port in Solibri's REST API settings / Swagger UI.)

RUN IT
------
Windows:  double-click  mycelium-for-solibri.exe
          (or run Install-Windows.cmd first for a Desktop shortcut)

macOS:    run  Install-macOS.command  once, then open
          "Mycelium for Solibri" from your Applications folder.

CONFIGURE
---------
The first launch creates a file called  solibri.config.json  and runs an
offline demo. Edit that file:

    {
      "SOLIBRI_BASE_URL": "http://localhost:10876/solibri/v1",
      "SOLIBRI_PROJECT_KEY": "horizons",
      "SOLIBRI_TOKEN": "",
      "SOLIBRI_CHECKING_PATH": ""
    }

  • SOLIBRI_BASE_URL      Solibri's REST API base (leave blank for offline demo)
  • SOLIBRI_PROJECT_KEY   a name for your project
  • SOLIBRI_TOKEN         only if your setup requires a bearer token
  • SOLIBRI_CHECKING_PATH optional: a Solibri plugin route that serves rule
                          results as JSON (the stock REST API has no such
                          endpoint — checking results otherwise arrive as BCF)

Save, then launch again. Results are printed and also written to
solibri-spine-output.json next to the config file.

Where are my files?
  Windows:  the folder the app was installed/run from
  macOS:    ~/MyceliumForSolibri/
