function setup_matpower()
  startDirectory = pwd;
  cd(getenv('MATPOWER_DIR'));
  install_matpower(1, 0, 0);
  cd(startDirectory);
end
